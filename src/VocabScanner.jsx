import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, query, onSnapshot, orderBy,
  serverTimestamp, writeBatch, doc
} from 'firebase/firestore'

// ─── 이미지 압축 (Canvas → base64) ───────────────────────────────
// Firestore 문서 한계: 1MB → base64 imageUrl은 700,000자 이하로 유지
// (base64 700KB ≈ 실제 JPEG 525KB, 나머지 fields 포함 시 ~750KB 예상)
const MAX_BASE64_CHARS = 700_000

async function compressImage(file, maxPx = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const obj = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(obj)

      function render(px, q) {
        const scale = Math.min(1, px / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', q)
      }

      // 1차: 기본 압축
      let dataUrl = render(maxPx, quality)

      // 2차: quality 단계적 감소 (0.72 → 0.62 → 0.52 → 0.42 → 0.32)
      let q = quality
      while (dataUrl.length > MAX_BASE64_CHARS && q > 0.32) {
        q = Math.max(0.32, q - 0.1)
        dataUrl = render(maxPx, q)
      }

      // 3차: 해상도까지 줄이기 (600px, 0.5)
      if (dataUrl.length > MAX_BASE64_CHARS) {
        dataUrl = render(600, 0.5)
      }

      // 4차: 최후 수단 (400px, 0.4)
      if (dataUrl.length > MAX_BASE64_CHARS) {
        dataUrl = render(400, 0.4)
      }

      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = obj
  })
}

// ─── Gemini API ───────────────────────────────────────────────────
async function analyzeVocabImage(base64, mediaType) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.')
  console.log('[Vocab] API Key 길이:', apiKey.length, '앞4자:', apiKey.slice(0, 4))

  const prompt = `이 이미지는 고등학교 영어 단어장 교재 사진입니다.
두 가지 형식 중 하나입니다. 정확하게 판단하여 처리해주세요.

━━━ 공통 무시 규칙 (매우 중요) ━━━
- 배경에 비쳐 보이는 텍스트 → 완전 무시
- 손글씨로 쓴 메모, 추가 표기 → 완전 무시
- 형광펜, 볼펜으로 친 밑줄/동그라미 → 무시 (단어 자체만 추출)
- 페이지 번호, 제목, QR코드 → 무시

━━━ 형식 A: 단어 목록 (wordlist) ━━━
특징: □ 체크박스와 영단어가 나열된 체크리스트. 빨간 사각형 펜으로 표시된 영역.
예시 이미지: "Previous Check" 제목, 단어들이 2~4열로 나열

처리:
1. 빨간색 테두리 안쪽 영단어만 추출 (테두리 밖 단어는 절대 추출 금지)
2. 인쇄된 영단어만 추출 (손글씨 무시)
3. 추출한 각 영단어의 가장 대표적인 한국어 뜻 2가지를 네가 직접 제공

━━━ 형식 B: 단어-뜻 표 (table) ━━━
특징: No, Word, Meaning 등 열 구분이 있는 표. 영단어와 한국어 뜻이 함께 있음.

처리:
1. Word 열(영단어가 있는 열)의 인쇄된 영단어만 추출
2. Meaning 열(한국어 뜻이 있는 열)의 인쇄된 한국어 뜻만 추출
3. 손글씨 메모(예: "소모시키는", "반병신적" 같은 추가 필기)는 절대 포함 금지
4. 인쇄된 원래 뜻만 사용 (예: "소모적인", "역효과를 낳는")
5. 표의 모든 행 추출, 번호 순서 유지

━━━ 응답 형식 ━━━
순수 JSON만 응답 (마크다운 블록 없이):

형식A: {"format":"wordlist","words":[{"word":"stimulate","meaning":"자극하다, 촉진하다"},{"word":"ritual","meaning":"의식, 의례"},{"word":"embassy","meaning":"대사관, 사절단"}]}

형식B: {"format":"table","words":[{"word":"praise","meaning":"칭송하다"},{"word":"exhausting","meaning":"소모적인"},{"word":"insensitivity","meaning":"무감각"}]}

JSON 외 다른 텍스트 절대 금지.`

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API 오류 (${resp.status})`)
  }

  const data = await resp.json()
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.')
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  const result = JSON.parse(text)
  if (!result.words?.length) throw new Error('단어를 찾지 못했습니다. 사진을 다시 시도해주세요.')
  return result
}

// ─── Firestore 날짜별 삭제 ────────────────────────────────────────
async function deleteScansForDate(scans) {
  if (!scans.length) return
  const batch = writeBatch(db)
  scans.forEach(s => batch.delete(doc(db, 'vocab-scans', s.id)))
  await batch.commit()
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────
function getTodayISO() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

// ─── ThumbnailImage ───────────────────────────────────────────────
function ThumbnailImage({ imageUrl, className = '', onClick }) {
  if (!imageUrl) return (
    <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
      <span className="text-2xl opacity-20">📷</span>
    </div>
  )
  return <img src={imageUrl} alt="스캔" className={`object-cover ${className}`} onClick={onClick} />
}

// ─── 단어 표 (반응형: 모바일 두줄 / 데스크톱 4열) ────────────────
function VocabTable({ scan }) {
  const [revealedMap, setRevealedMap] = useState({})
  const [checkedMap, setCheckedMap] = useState({})
  const [shuffledOrder, setShuffledOrder] = useState(null)

  const displayWords = shuffledOrder ? shuffledOrder.map(i => scan.words[i]) : scan.words

  const toggleReveal = i => setRevealedMap(p => ({ ...p, [i]: !p[i] }))
  const toggleCheck = i => setCheckedMap(p => ({ ...p, [i]: !p[i] }))
  const allRevealed = displayWords.every((_, i) => revealedMap[i])
  const toggleAll = () => {
    if (allRevealed) setRevealedMap({})
    else { const m = {}; displayWords.forEach((_, i) => { m[i] = true }); setRevealedMap(m) }
  }
  const toggleShuffle = () => {
    if (shuffledOrder) {
      setShuffledOrder(null)
    } else {
      const idx = scan.words.map((_, i) => i)
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]]
      }
      setShuffledOrder(idx)
    }
    setRevealedMap({})
    setCheckedMap({})
  }

  return (
    <div className="w-full">
      {/* 셔플 토글 버튼 */}
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleShuffle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-all active:scale-95"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            background: shuffledOrder ? 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)' : '#F1F5F9',
            color: shuffledOrder ? 'white' : '#64748B',
            boxShadow: shuffledOrder ? '0 2px 8px rgba(232,105,74,0.35)' : 'none',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
          SHUFFLE {shuffledOrder ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">

        {/* ── 헤더: 모바일 3열 / 데스크톱 4열 ── */}
        <div className="grid grid-cols-[32px_1fr_32px] sm:grid-cols-[40px_1fr_1fr_40px] bg-gray-800 text-white text-xs font-semibold">
          <div className="px-1 py-2.5 text-center">No</div>
          <div className="px-2 py-2.5 cursor-pointer select-none" onDoubleClick={toggleAll}>Word <span className="opacity-60 ml-1">{displayWords.length}</span> <span className="sm:hidden">{allRevealed ? '🔓' : '🔒'}</span></div>
          <div className="hidden sm:block px-2 py-2.5 cursor-pointer select-none" onDoubleClick={toggleAll}>Meaning {allRevealed ? '🔓' : '🔒'}</div>
          <div className="px-1 py-2.5 text-center">✓</div>
        </div>

        {/* ── 단어 행 ── */}
        {displayWords.map((item, i) => (
          <div
            key={i}
            className={`border-b border-gray-50 last:border-0 transition-colors cursor-pointer select-none ${
              checkedMap[i] ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
            }`}
            onClick={() => toggleReveal(i)}
          >
            {/* 모바일: 두 줄 레이아웃 (sm 미만) */}
            <div className="grid grid-cols-[32px_1fr_32px] sm:hidden">
              <div className="px-1 py-2 text-center text-[10px] text-gray-400 font-medium flex items-center justify-center">
                {i + 1}
              </div>
              <div className="px-2 py-2">
                <div className={`text-sm font-semibold leading-tight ${checkedMap[i] ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {item.word}
                </div>
                <div className="mt-1">
                  {revealedMap[i] ? (
                    <span className="text-xs font-medium" style={{ color: '#0D9488' }}>{item.meaning}</span>
                  ) : (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold italic"
                      style={{ backgroundColor: '#FFF3F0', color: '#E8694A', border: '1.5px solid #FECDBB' }}
                    >
                      view meaning
                    </span>
                  )}
                </div>
              </div>
              <div className="px-1 py-2 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => toggleCheck(i)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    checkedMap[i] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {checkedMap[i] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                </button>
              </div>
            </div>

            {/* 데스크톱: 4열 레이아웃 (sm 이상) */}
            <div className="hidden sm:grid grid-cols-[40px_1fr_1fr_40px]">
              <div className="px-1 py-3 text-center text-xs text-gray-400 font-medium flex items-center justify-center">
                {i + 1}
              </div>
              <div className={`px-2 py-3 text-sm font-medium flex items-center ${checkedMap[i] ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {item.word}
              </div>
              <div className="px-2 py-3 flex items-center">
                {revealedMap[i] ? (
                  <span className="text-sm font-medium" style={{ color: '#0D9488' }}>{item.meaning}</span>
                ) : (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold italic"
                    style={{ backgroundColor: '#FFF3F0', color: '#E8694A', border: '1.5px solid #FECDBB' }}
                  >
                    view meaning
                  </span>
                )}
              </div>
              <div className="px-1 py-3 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => toggleCheck(i)}
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                    checkedMap[i] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {checkedMap[i] && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 빈 화면 ─────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
      <p className="text-[10px] text-gray-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Select a folder →</p>
    </div>
  )
}

// ─── 아이폰 스타일 추가 메뉴 ──────────────────────────────────────
function AddMenu({ anchor, onCamera, onGallery, onFiles, onClose }) {
  const MENU_W = 172
  // anchor: { top, right } — 메뉴 우측이 버튼 좌측에 맞닿도록
  const style = {
    position: 'fixed',
    top: anchor.top,
    right: anchor.right,
    width: MENU_W,
    zIndex: 60,
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ ...style, border: '1px solid rgba(0,0,0,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 사진 찍기 */}
        <button
          onClick={onCamera}
          className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-100 transition-colors"
        >
          <span className="text-lg leading-none">📷</span>
          <span className="text-[13px] font-semibold text-gray-900">사진 찍기</span>
        </button>
        <div className="border-t border-gray-100 mx-3" />
        {/* 사진 보관함 */}
        <button
          onClick={onGallery}
          className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-100 transition-colors"
        >
          <span className="text-lg leading-none">🖼️</span>
          <span className="text-[13px] font-semibold text-gray-900">사진 보관함</span>
        </button>
        <div className="border-t border-gray-100 mx-3" />
        {/* 파일 선택 */}
        <button
          onClick={onFiles}
          className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-100 transition-colors"
        >
          <span className="text-lg leading-none">📂</span>
          <span className="text-[13px] font-semibold text-gray-900">파일 선택</span>
        </button>
      </div>
    </div>
  )
}

// ─── Pull-to-Refresh 훅 ───────────────────────────────────────────
function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    let startY = 0, startX = 0, canPull = false
    const onStart = (e) => {
      startY = e.touches[0].clientY; startX = e.touches[0].clientX
      canPull = (window.scrollY || document.documentElement.scrollTop) === 0
    }
    const onEnd = (e) => {
      if (!canPull) return
      const dy = e.changedTouches[0].clientY - startY
      const dx = Math.abs(e.changedTouches[0].clientX - startX)
      if (dy > 80 && dx < 40) { setRefreshing(true); setTimeout(() => setRefreshing(false), 700) }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend',   onEnd,   { passive: true })
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [])
  return refreshing
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function VocabScanner({ onBack, nickname, addTrigger }) {
  const isRefreshing = usePullToRefresh()
  const [scans, setScans] = useState([])
  const [expandedDate, setExpandedDate] = useState(null)   // 사이드바 아코디언
  const [selectedScan, setSelectedScan] = useState(null)   // 좌측 단어 표시
  const [viewingImageUrl, setViewingImageUrl] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 0 })

  const addBtnRef = useRef()
  const cameraRef = useRef()
  const galleryRef = useRef()
  const filesRef = useRef()

  // Firestore 구독
  useEffect(() => {
    const q = query(collection(db, 'vocab-scans'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setScans(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => setError(`로드 실패: ${err.code}`))
  }, [])

  const scansByDate = scans.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})
  const sortedDates = Object.keys(scansByDate).sort((a, b) => b.localeCompare(a))

  // 외부 ADD 트리거 (네비 + 버튼)
  useEffect(() => {
    if (addTrigger > 0) {
      setMenuAnchor({ top: window.innerHeight * 0.38, right: window.innerWidth / 2 - 86 })
      setShowAddMenu(true)
    }
  }, [addTrigger])

  // +ADD 버튼 클릭 → 메뉴 위치 계산
  const openAddMenu = () => {
    const rect = addBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setMenuAnchor({
        top: rect.top,
        right: window.innerWidth - rect.left + 6,
      })
    }
    setShowAddMenu(true)
  }

  // 사진 처리 공통
  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setShowAddMenu(false)
    setAnalyzing(true)
    setError('')
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = ev => res(ev.target.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const result = await analyzeVocabImage(base64, file.type || 'image/jpeg')
      const imageUrl = await compressImage(file)
      const today = getTodayISO()
      await addDoc(collection(db, 'vocab-scans'), {
        date: today, imageUrl,
        format: result.format, words: result.words,
        author: nickname || '익명', createdAt: serverTimestamp(),
      })
      setExpandedDate(today)
    } catch (err) {
      console.error(err); setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // 날짜 폴더 전체 삭제
  const handleDeleteFolder = async (date, e) => {
    e.stopPropagation()
    if (!window.confirm(`${date} 폴더를 삭제하시겠습니까?`)) return
    await deleteScansForDate(scansByDate[date] || [])
    if (expandedDate === date) setExpandedDate(null)
    if (selectedScan?.date === date) setSelectedScan(null)
  }

  // 개별 스캔 삭제
  const handleDeleteScan = async (scan, e) => {
    e.stopPropagation()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'vocab-scans', scan.id))
    await batch.commit()
    if (selectedScan?.id === scan.id) setSelectedScan(null)
  }

  // 이미지 전체보기
  const handleViewImage = (imageUrl) => {
    if (imageUrl) setViewingImageUrl(imageUrl)
    else setError('원본 이미지를 찾을 수 없습니다.')
  }
  const closeViewer = () => setViewingImageUrl(null)

  // 폴더 아코디언 토글
  const toggleFolder = (date) => {
    if (expandedDate === date) {
      setExpandedDate(null)
    } else {
      setExpandedDate(date)
      // 폴더 열 때 첫 스캔 자동 선택
      const first = scansByDate[date]?.[0]
      if (first) setSelectedScan(first)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col pb-16">
      {isRefreshing && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center py-2 pointer-events-none">
          <div className="w-7 h-7 rounded-full border-2 border-gray-100 animate-spin" style={{ borderTopColor: '#E8694A' }} />
        </div>
      )}

      {/* 헤더 */}
      <div className="flex-shrink-0 flex items-center px-4 border-b border-gray-100"
        style={{ height: 58, backgroundColor: '#FAFAFA' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-xl active:opacity-70 transition-opacity"
            style={{ width: 36, height: 36, border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" stroke="#E8694A" strokeWidth="2.5"/>
            </svg>
          </button>
          <span className="font-black tracking-widest uppercase"
            style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>
            VOCAB BOOK
          </span>
        </div>
      </div>

      {/* 오류 */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <span className="text-red-500 shrink-0">⚠️</span>
          <span className="text-red-700 text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* 본문 — 75/25 분할 */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

        {/* 좌측 75% */}
        <div className="overflow-y-auto flex flex-col" style={{ width: '75%' }}>
          {selectedScan && (
            <div className="sticky top-0 z-10 flex items-center px-4 py-2.5 border-b border-gray-100"
              style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
              <button
                onClick={() => setSelectedScan(null)}
                className="flex items-center gap-1.5 text-[11px] font-bold active:opacity-60 transition-opacity"
                style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                BACK
              </button>
            </div>
          )}
          <div className="p-4 flex-1">
            {selectedScan ? (
              <VocabTable scan={selectedScan} />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* 우측 25% — 사이드바 */}
        <div className="bg-white border-l border-gray-100 overflow-y-auto flex flex-col" style={{ width: '25%' }}>

          {/* +ADD 버튼 */}
          <div className="flex-shrink-0 px-2 py-2 border-b border-gray-100">
            <button
              ref={addBtnRef}
              onClick={openAddMenu}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-white text-[10px] font-black shadow-sm active:opacity-75 transition-opacity"
              style={{ backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              ADD
            </button>
          </div>

          {/* 날짜 폴더 아코디언 목록 */}
          <div className="flex flex-col pb-3">
            {sortedDates.length === 0 && (
              <p className="text-[9px] text-center text-gray-300 mt-6 leading-relaxed">폴더 없음</p>
            )}
            {sortedDates.map(date => {
              const [, m, d] = date.split('-')
              const isExpanded = expandedDate === date
              const dateScans = scansByDate[date] || []
              return (
                <div key={date}>
                  {/* 폴더 버튼 */}
                  <div className="relative px-2 pt-2">
                    {/* 폴더 삭제 X */}
                    <button
                      onClick={(e) => handleDeleteFolder(date, e)}
                      className="absolute top-3 left-3 z-10 w-4 h-4 rounded-full bg-gray-300 hover:bg-red-400 text-white flex items-center justify-center transition-colors"
                      style={{ fontSize: 8, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => toggleFolder(date)}
                      className="w-full rounded-xl p-2 pt-2.5 text-center transition-all border active:opacity-70"
                      style={{
                        borderColor: isExpanded ? '#E8694A' : '#F1F5F9',
                        backgroundColor: isExpanded ? '#FFF3F0' : '#F8FAFC',
                      }}
                    >
                      <div className="text-base">{isExpanded ? '📂' : '📁'}</div>
                      <div className="text-[10px] font-bold mt-0.5" style={{ color: isExpanded ? '#E8694A' : '#374151' }}>{m}/{d}</div>
                      <div className="text-[9px] text-gray-400">{dateScans.length}개</div>
                    </button>
                  </div>

                  {/* 아코디언 — 파일 썸네일들 */}
                  {isExpanded && (
                    <div className="px-2 pt-1.5 pb-1 flex flex-col gap-1.5">
                      {dateScans.map((scan) => (
                        <div
                          key={scan.id}
                          className="relative rounded-xl overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
                          style={{
                            border: selectedScan?.id === scan.id
                              ? '2.5px solid #E8694A'
                              : '2px solid #F1F5F9',
                          }}
                          onClick={() => setSelectedScan(scan)}
                          onDoubleClick={() => handleViewImage(scan.imageUrl)}
                        >
                          {/* 삭제 X — 좌상단 */}
                          <button
                            onClick={(e) => handleDeleteScan(scan, e)}
                            className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                            style={{ backgroundColor: 'rgba(0,0,0,0.45)', fontSize: 9 }}
                          >
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                            </svg>
                          </button>

                          {/* 썸네일 이미지 */}
                          <div className="w-full bg-gray-100" style={{ aspectRatio: '4/3' }}>
                            <ThumbnailImage imageUrl={scan.imageUrl} className="w-full h-full" />
                          </div>

                          {/* 단어 수 배지 */}
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md text-white text-[9px] font-bold"
                            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                            {scan.words.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 아이폰 스타일 추가 메뉴 */}
      {showAddMenu && (
        <AddMenu
          anchor={menuAnchor}
          onCamera={() => { setShowAddMenu(false); cameraRef.current?.click() }}
          onGallery={() => { setShowAddMenu(false); galleryRef.current?.click() }}
          onFiles={() => { setShowAddMenu(false); filesRef.current?.click() }}
          onClose={() => setShowAddMenu(false)}
        />
      )}

      {/* 숨겨진 파일 input */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={filesRef} type="file" accept="image/*,image/heic,image/heif" className="hidden" onChange={handleFile} />

      {/* 분석 오버레이 */}
      {analyzing && (
        <div className="fixed inset-0 bg-white/90 z-50 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-gray-200 rounded-full animate-spin"
            style={{ borderTopColor: '#E8694A' }} />
          <div className="text-center">
            <p className="text-gray-800 font-bold">AI가 단어를 인식 중...</p>
            <p className="text-gray-500 text-sm mt-1">잠시만 기다려 주세요</p>
          </div>
        </div>
      )}

      {/* 원본 이미지 뷰어 */}
      {viewingImageUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeViewer}>
          <button
            className="absolute top-5 right-5 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl"
            onClick={closeViewer}
          >✕</button>
          <img src={viewingImageUrl} alt="원본" className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
