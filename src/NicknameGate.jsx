import { useState } from 'react'

export default function NicknameGate({ onEnter }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) { setError('이름을 입력해주세요.'); return }
    if (trimmed.length > 20) { setError('이름은 20자 이내로 입력해주세요.'); return }
    onEnter(trimmed)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(160deg, #FFF3F0 0%, #FDFAF9 45%, #F0FDFB 100%)' }}
    >
      {/* 로고 영역 */}
      <div className="mb-10 flex flex-col items-center">
        <div
          className="mb-4 w-[72px] h-[72px] rounded-[22px] flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', boxShadow: '0 8px 28px rgba(232,105,74,0.38)' }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
        </div>
        <span
          className="text-[32px] font-black tracking-tight leading-none"
          style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
        >짬뜰</span>
        <span
          className="text-[11px] mt-1.5 tracking-widest uppercase"
          style={{ color: '#C4B8AF', fontFamily: 'JetBrains Mono, monospace' }}
        >study with me</span>
      </div>

      {/* 입력 카드 */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.10)' }}>
        {/* 상단 코랄 액센트 */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #F5A58A 0%, #E8694A 50%, #D4845A 100%)' }} />

        <div className="px-6 pt-7 pb-8">
          <p
            className="text-[10px] font-black tracking-[0.22em] mb-1 uppercase"
            style={{ color: '#D1C4BC', fontFamily: 'JetBrains Mono, monospace' }}
          >Welcome</p>
          <p
            className="text-[18px] font-black text-gray-800 mb-7"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >이름을 알려주세요</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={value}
                onChange={e => { setValue(e.target.value); setError('') }}
                placeholder="사용할 이름 입력..."
                className="w-full px-4 py-3.5 rounded-2xl text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all"
                style={{
                  background: '#FAFAF9',
                  border: error ? '2px solid #FCA5A5' : '2px solid #F0EDE8',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                onFocus={e => { if (!error) e.target.style.borderColor = '#E8694A' }}
                onBlur={e => { if (!error) e.target.style.borderColor = '#F0EDE8' }}
                autoFocus
                maxLength={20}
              />
              {error && (
                <p
                  className="text-xs mt-1.5 ml-1"
                  style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
                >{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl text-white font-black text-[13px] tracking-widest shadow-md active:opacity-80 active:scale-[0.98] transition-all"
              style={{
                background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)',
                boxShadow: '0 4px 18px rgba(232,105,74,0.38)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              START →
            </button>
          </form>

          <p
            className="text-center text-[10px] mt-5"
            style={{ color: '#D1C4BC', fontFamily: 'JetBrains Mono, monospace' }}
          >닉네임은 할일 작성 시 표시됩니다</p>
        </div>
      </div>
    </div>
  )
}
