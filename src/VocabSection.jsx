import { useState, useRef, useCallback } from 'react'

/* ── 형광펜 색상 팔레트 ── */
const HIGHLIGHT_COLORS = [
  'rgba(255, 235, 0, 0.78)',
  'rgba(100, 255, 140, 0.68)',
  'rgba(255, 105, 180, 0.58)',
  'rgba(80, 200, 255, 0.62)',
  'rgba(255, 155, 50, 0.68)',
]
function randomColor() {
  return HIGHLIGHT_COLORS[Math.floor(Math.random() * HIGHLIGHT_COLORS.length)]
}

/* ── OCR 텍스트 → 단어 목록 파싱 ── */
function parseVocabText(raw) {
  const lines = raw.split('\n')
  const words = []
  for (const raw of lines) {
    const line = raw.replace(/^[\d\.\)\s\-\*▪•]+/, '').trim()
    if (line.length < 2) continue
    if (!/[a-zA-Z]/.test(line)) continue

    const korIdx = line.search(/[가-힣]/)
    let word, meaning

    if (korIdx > 0) {
      // 영어 + 한국어 뜻이 한 줄에 있는 경우
      word = line.slice(0, korIdx)
        .replace(/\[.*?\]/g, '')      // 발음기호 제거
        .replace(/[\/\-:\s\.]+$/, '')
        .trim()
      meaning = line.slice(korIdx).trim()
    } else {
      // 영어만 있는 경우
      word = line.replace(/\[.*?\]/g, '').replace(/[^a-zA-Z\s'\-]/g, '').trim()
      meaning = ''
    }

    if (word.length < 2 || word.length > 40) continue
    words.push({
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      word,
      meaning,
      memorized: false,
      meaningVisible: false,
      color: randomColor(),
    })
  }
  return words
}

/* ── 단어 카드 ── */
function WordCard({ word, index, onMemorize, onRevealMeaning }) {
  return (
    <div
      className={`mb-1.5 rounded-2xl overflow-hidden transition-all duration-200 ${
        word.memorized ? 'border border-green-100' : 'border border-gray-100/80'
      }`}
      style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      {/* 단어 행 — 탭하면 형광펜 강조 */}
      <div
        className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 cursor-pointer active:bg-gray-50/70 select-none"
        onClick={onMemorize}
      >
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: 9,
            color: '#CBD5E1',
            minWidth: 14,
            flexShrink: 0,
          }}
        >
          {index}
        </span>
        {word.memorized ? (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 800,
              fontSize: 14,
              color: '#111827',
              lineHeight: 1.5,
              background: `linear-gradient(transparent 54%, ${word.color} 46%)`,
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            {word.word}
          </span>
        ) : (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              fontSize: 14,
              color: '#111827',
              lineHeight: 1.5,
            }}
          >
            {word.word}
          </span>
        )}
        <span
          className="ml-auto text-[8.5px] font-black tracking-widest"
          style={{
            color: word.memorized ? '#4ADE80' : '#E5E7EB',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.12em',
          }}
        >
          {word.memorized ? '✓ DONE' : '——'}
        </span>
      </div>

      {/* 뜻 행 — 기본 숨김, 탭하면 표시 */}
      {word.meaning && (
        <div
          className="relative px-3 pb-2.5 cursor-pointer active:bg-gray-50/70 select-none"
          style={{ minHeight: 30 }}
          onClick={onRevealMeaning}
        >
          <span
            className="text-xs leading-relaxed transition-opacity duration-200"
            style={{
              color: word.meaningVisible ? '#6B7280' : 'transparent',
              fontSize: 12,
              display: 'block',
              lineHeight: 1.6,
            }}
          >
            {word.meaning}
          </span>
          {!word.meaningVisible && (
            <div className="absolute inset-x-3 inset-y-0 flex items-center">
              <div
                className="flex items-center gap-1 px-2 h-5 rounded-md"
                style={{ backgroundColor: '#F1F5F9' }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#94A3B8',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  뜻 보기
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 메인 VocabSection ── */
export default function VocabSection() {
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [processingPct, setProcessingPct] = useState(0)
  const [pendingPhotos, setPendingPhotos] = useState([])
  const [showMoreDialog, setShowMoreDialog] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState(null) // null = 원래 순서

  const cameraRef = useRef(null)
  const fileRef = useRef(null)

  /* OCR 실행 */
  async function runOCR(photos) {
    if (!photos.length) return
    setIsProcessing(true)
    setProcessingPct(0)
    setProcessingMsg('준비 중...')
    const allWords = []
    try {
      const { createWorker } = await import('tesseract.js')
      setProcessingMsg('언어 데이터 로드 중...')
      const worker = await createWorker(['eng', 'kor'], 1, {
        logger: m => {
          if (m.status === 'loading language traineddata') {
            setProcessingMsg('언어 데이터 다운로드 중...')
          } else if (m.status === 'recognizing text') {
            setProcessingPct(Math.round(m.progress * 100))
            setProcessingMsg(`텍스트 인식 중... ${Math.round(m.progress * 100)}%`)
          }
        },
      })
      for (let i = 0; i < photos.length; i++) {
        setProcessingMsg(`분석 중 (${i + 1}/${photos.length})...`)
        const { data: { text } } = await worker.recognize(photos[i].dataUrl)
        allWords.push(...parseVocabText(text))
      }
      await worker.terminate()
    } catch (err) {
      console.error('OCR error:', err)
      setProcessingMsg('인식에 실패했습니다')
      setTimeout(() => setIsProcessing(false), 1500)
      return
    }
    const session = {
      id: `s-${Date.now()}`,
      photos: photos.map(p => p.dataUrl),
      words: allWords,
      date: new Date().toLocaleDateString('ko-KR'),
    }
    setSessions(prev => [session, ...prev])
    setSelectedSessionId(session.id)
    setPendingPhotos([])
    setIsProcessing(false)
  }

  /* 파일 입력 핸들러 */
  function handleInput(e, isCamera) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    let done = 0
    const newPhotos = []
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        newPhotos.push({ dataUrl: ev.target.result })
        done++
        if (done === files.length) {
          const all = [...pendingPhotos, ...newPhotos]
          if (isCamera) {
            setPendingPhotos(all)
            setShowMoreDialog(true)
          } else {
            setPendingPhotos([])
            runOCR(all)
          }
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
    setShowAddSheet(false)
  }

  function toggleMemorized(sid, wid) {
    setSessions(prev => prev.map(s => s.id !== sid ? s : {
      ...s, words: s.words.map(w => w.id !== wid ? w : { ...w, memorized: !w.memorized })
    }))
  }
  function toggleMeaning(sid, wid) {
    setSessions(prev => prev.map(s => s.id !== sid ? s : {
      ...s, words: s.words.map(w => w.id !== wid ? w : { ...w, meaningVisible: !w.meaningVisible })
    }))
  }
  function deleteSession(sid) {
    setSessions(prev => prev.filter(s => s.id !== sid))
  }
  function revealAll(sid) {
    setSessions(prev => prev.map(s => s.id !== sid ? s : {
      ...s, words: s.words.map(w => ({ ...w, meaningVisible: true }))
    }))
  }
  function hideAll(sid) {
    setSessions(prev => prev.map(s => s.id !== sid ? s : {
      ...s, words: s.words.map(w => ({ ...w, meaningVisible: false }))
    }))
  }
  function toggleShuffle(words) {
    if (shuffledOrder) {
      setShuffledOrder(null)
    } else {
      const indices = words.map((_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]]
      }
      setShuffledOrder(indices)
    }
  }

  const currentSession = selectedSessionId ? sessions.find(s => s.id === selectedSessionId) : null
  const totalWords = sessions.reduce((n, s) => n + s.words.length, 0)
  const memorized = sessions.reduce((n, s) => n + s.words.filter(w => w.memorized).length, 0)

  return (
    <div
      className="flex overflow-hidden bg-stone-50"
      style={{ height: 'calc(100vh - 125px - 64px)' }}
    >
      {/* 파일 입력 (숨김) */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={e => handleInput(e, true)} />
      <input ref={fileRef} type="file" accept="image/*" multiple
        className="hidden" onChange={e => handleInput(e, false)} />

      {/* ── 좌측 75% — 단어 목록 ── */}
      <div className="flex flex-col overflow-hidden" style={{ width: '75%' }}>
        {/* 상단 바 */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-gray-100"
          style={{ backgroundColor: '#FAFAFA' }}
        >
          {currentSession ? (
            <button
              onClick={() => { setSelectedSessionId(null); setShuffledOrder(null) }}
              className="flex items-center gap-1.5 text-[10px] font-bold active:opacity-60 transition-opacity"
              style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              BACK
            </button>
          ) : (
            <div>
              <p
                className="text-[10px] font-black tracking-[0.2em] uppercase"
                style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}
              >
                Vocab Book
              </p>
              {totalWords > 0 && (
                <p
                  className="text-[9px] tabular-nums"
                  style={{ color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {memorized}/{totalWords} done
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-bold shadow-sm active:opacity-75 transition-opacity"
            style={{ backgroundColor: '#E8694A' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            +ADD
          </button>
        </div>

        {/* 단어 카드 목록 */}
        <div className="flex-1 overflow-y-auto">
          {!currentSession ? (
            <div className="flex flex-col items-center justify-center h-full pb-8 text-center px-6">
              {sessions.length === 0 ? (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                    style={{ backgroundColor: '#FFF3F0' }}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-gray-400 mb-1">단어장이 비어있어요</p>
                  <p className="text-[10px] text-gray-300 leading-relaxed">
                    단어장 사진을 찍으면<br/>단어가 자동으로 인식돼요
                  </p>
                </>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                  <p className="text-[10px] text-gray-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Select a folder →
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="px-3 pt-2.5 pb-24">
              {(() => {
                const session = currentSession
                const done = session.words.filter(w => w.memorized).length
                const allRevealed = session.words.length > 0 && session.words.every(w => w.meaningVisible)
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <div className="flex-1 h-px" style={{ backgroundColor: '#F1F5F9' }} />
                      <span
                        className="text-[9px] font-bold tabular-nums"
                        style={{ color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {done}/{session.words.length}
                      </span>
                      <button
                        onClick={() => toggleShuffle(session.words)}
                        className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          color: shuffledOrder ? '#E8694A' : '#94A3B8',
                          fontFamily: 'JetBrains Mono, monospace',
                          backgroundColor: shuffledOrder ? '#FFF3F0' : '#F8FAFC',
                          border: `1px solid ${shuffledOrder ? '#E8694A' : '#E2E8F0'}`,
                        }}
                      >
                        {shuffledOrder ? '순서복원' : '섞기'}
                      </button>
                      <button
                        onClick={() => allRevealed ? hideAll(session.id) : revealAll(session.id)}
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{
                          color: '#94A3B8',
                          fontFamily: 'JetBrains Mono, monospace',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {allRevealed ? '뜻 숨기기' : '뜻 전체보기'}
                      </button>
                      <button
                        onClick={() => { deleteSession(session.id); setSelectedSessionId(null); setShuffledOrder(null) }}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-200 hover:text-red-300 transition-colors"
                        style={{ fontSize: 10 }}
                      >
                        ✕
                      </button>
                    </div>
                    {session.words.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-4">인식된 단어가 없습니다</p>
                    ) : (
                      (() => {
                        const displayWords = shuffledOrder
                          ? shuffledOrder.map(i => session.words[i])
                          : session.words
                        return displayWords.map((word, idx) => (
                          <WordCard
                            key={word.id}
                            word={word}
                            index={idx + 1}
                            onMemorize={() => toggleMemorized(session.id, word.id)}
                            onRevealMeaning={() => toggleMeaning(session.id, word.id)}
                          />
                        ))
                      })()
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── 우측 25% — 날짜 폴더 ── */}
      <div
        className="flex-shrink-0 overflow-y-auto border-l"
        style={{ width: '25%', borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' }}
      >
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-8 gap-2">
            <div
              className="w-10 h-10 rounded-xl border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: '#E2E8F0' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </div>
          </div>
        ) : (
          <div className="p-1.5 pt-2.5 space-y-1.5">
            {sessions.map(session => {
              const isSelected = selectedSessionId === session.id
              const done = session.words.filter(w => w.memorized).length
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className="w-full rounded-xl p-2 text-left transition-all active:opacity-70 border"
                  style={{
                    backgroundColor: isSelected ? '#FFF3F0' : '#F8FAFC',
                    borderColor: isSelected ? '#E8694A' : '#F1F5F9',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={isSelected ? '#E8694A' : '#94A3B8'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="mb-1"
                  >
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                  <p
                    className="text-[8px] font-bold leading-tight"
                    style={{
                      color: isSelected ? '#E8694A' : '#64748B',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {session.date}
                  </p>
                  <p
                    className="text-[7px] tabular-nums mt-0.5"
                    style={{ color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {done}/{session.words.length}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 추가 시트 ── */}
      {showAddSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowAddSheet(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-md pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-6 pt-3 pb-2">
              <p
                className="text-center text-sm font-black text-gray-700 mb-5 tracking-wide"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                VOCAB BOOK 추가
              </p>
              <div className="space-y-2.5">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="w-full py-4 rounded-2xl flex items-center gap-4 px-5 active:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#FFF3F0' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#E8694A' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">사진 찍기</p>
                    <p className="text-[11px] text-gray-400">카메라로 단어장을 촬영해요</p>
                  </div>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-4 rounded-2xl flex items-center gap-4 px-5 active:opacity-80 transition-opacity bg-gray-50"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#F1F5F9' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-700">갤러리에서 선택</p>
                    <p className="text-[11px] text-gray-400">저장된 사진을 불러와요</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 추가 사진 여부 다이얼로그 ── */}
      {showMoreDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#FFF3F0' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <p className="text-center font-black text-gray-800 mb-1">
              {pendingPhotos.length}장 촬영됨
            </p>
            <p className="text-center text-sm text-gray-400 mb-6 leading-relaxed">
              추가로 찍을 사진이 있나요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowMoreDialog(false); runOCR(pendingPhotos) }}
                className="flex-1 py-3 rounded-2xl border-2 text-sm font-bold text-gray-500 transition-colors"
                style={{ borderColor: '#E5E7EB' }}
              >
                없어요
              </button>
              <button
                onClick={() => { setShowMoreDialog(false); cameraRef.current?.click() }}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-bold shadow-sm active:opacity-80"
                style={{ backgroundColor: '#E8694A' }}
              >
                더 찍기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OCR 처리 중 오버레이 ── */}
      {isProcessing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
        >
          <div className="bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <p className="text-center font-black text-gray-800 mb-1">단어 인식 중</p>
            <p
              className="text-center text-xs text-gray-400 mb-4 h-4"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {processingMsg}
            </p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${processingPct}%`, backgroundColor: '#E8694A' }}
              />
            </div>
            <p
              className="text-center text-[10px] mt-2 tabular-nums"
              style={{ color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {processingPct}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
