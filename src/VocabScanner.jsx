import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, query, onSnapshot, orderBy,
  serverTimestamp, writeBatch, doc
} from 'firebase/firestore'

// ─── IndexedDB (이미지 로컬 저장) ────────────────────────────────
const IDB_NAME = 'studybuddy-vocab-imgs'
const IDB_VER = 1
const IDB_STORE = 'images'

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER)
    req.onupgradeneeded = (e) =>
      e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbSave(blob) {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).add({ blob })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => idb.close()
  })
}
async function idbGet(id) {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(Number(id))
    req.onsuccess = () => resolve(req.result?.blob || null)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => idb.close()
  })
}

// ─── Gemini API ───────────────────────────────────────────────────
async function analyzeVocabImage(base64, mediaType) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.')

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
function formatDateKo(iso) {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${m}월 ${d}일`
}

// ─── ThumbnailImage ───────────────────────────────────────────────
function ThumbnailImage({ imageId, className = '', onClick }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let obj
    idbGet(imageId).then(blob => {
      if (blob) { obj = URL.createObjectURL(blob); setUrl(obj) }
    })
    return () => { if (obj) URL.revokeObjectURL(obj) }
  }, [imageId])

  if (!url) return (
    <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
      <span className="text-xl opacity-30">📷</span>
    </div>
  )
  return <img src={url} alt="스캔" className={`object-cover ${className}`} onClick={onClick} />
}

// ─── 4열 단어 표 ──────────────────────────────────────────────────
function VocabTable({ scan, onBack, onViewImage }) {
  const [revealedMap, setRevealedMap] = useState({})
  const [checkedMap, setCheckedMap] = useState({})
  const allRevealed = scan.words.every((_, i) => revealedMap[i])

  const toggleReveal = i => setRevealedMap(p => ({ ...p, [i]: !p[i] }))
  const toggleCheck = i => setCheckedMap(p => ({ ...p, [i]: !p[i] }))
  const toggleAll = () => {
    if (allRevealed) setRevealedMap({})
    else {
      const m = {}; scan.words.forEach((_, i) => { m[i] = true }); setRevealedMap(m)
    }
  }

  const doneCount = Object.values(checkedMap).filter(Boolean).length

  return (
    <div className="max-w-2xl mx-auto">
      {/* 상단 컨트롤 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
        >
          ← 목록
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">{formatDateKo(scan.date)} · {scan.format === 'table' ? '표 형식' : '단어 목록'}</p>
          <p className="text-sm font-bold text-gray-800">
            {scan.words.length}개 단어
            {doneCount > 0 && <span className="text-green-600 ml-2">✓ {doneCount}개 완료</span>}
          </p>
        </div>
        {scan.imageId && (
          <button
            onClick={() => onViewImage(scan.imageId)}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl"
          >📷 원본</button>
        )}
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs rounded-xl font-medium"
          style={{ backgroundColor: '#FFF3F0', color: '#E8694A', border: '1px solid #FECDBB' }}
        >
          {allRevealed ? '뜻 숨기기' : '뜻 전체 보기'}
        </button>
      </div>

      {/* 표 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        {/* 헤더 */}
        <div className="grid grid-cols-[44px_1fr_1fr_44px] bg-gray-800 text-white text-sm font-semibold">
          <div className="px-2 py-3 text-center">No</div>
          <div className="px-3 py-3">Word</div>
          <div className="px-3 py-3">Meaning</div>
          <div className="px-2 py-3 text-center">✓</div>
        </div>

        {/* 단어 행 */}
        {scan.words.map((item, i) => (
          <div
            key={i}
            className={`grid grid-cols-[44px_1fr_1fr_44px] border-b border-gray-50 last:border-0 transition-colors ${
              checkedMap[i] ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
            }`}
          >
            {/* 번호 */}
            <div className="px-2 py-3 text-center text-xs text-gray-400 font-medium flex items-center justify-center">
              {i + 1}
            </div>
            {/* 단어 */}
            <div className={`px-3 py-3 text-sm font-medium flex items-center ${checkedMap[i] ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {item.word}
            </div>
            {/* 뜻 — 탭하여 토글 */}
            <div
              className="px-3 py-3 flex items-center cursor-pointer select-none"
              onClick={() => toggleReveal(i)}
            >
              {revealedMap[i] ? (
                <span className="text-sm font-medium" style={{ color: '#0D9488' }}>{item.meaning}</span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#F0FDFA', color: '#0D9488', border: '1px solid #CCFBF1' }}>
                  탭하여 확인
                </span>
              )}
            </div>
            {/* 체크박스 */}
            <div className="px-2 py-3 flex items-center justify-center">
              <button
                onClick={() => toggleCheck(i)}
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  checkedMap[i]
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {checkedMap[i] && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">Meaning 칸을 탭하면 뜻이 보입니다</p>
    </div>
  )
}

// ─── 폴더 내 파일 목록 ────────────────────────────────────────────
function FileListView({ date, scans, onSelectScan, onViewImage }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">{formatDateKo(date)} · {scans.length}개 파일</p>
      <div className="grid grid-cols-2 gap-3">
        {scans.map((scan) => (
          <div
            key={scan.id}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => onSelectScan(scan)}
          >
            <div className="h-32 overflow-hidden bg-gray-50">
              <ThumbnailImage
                imageId={scan.imageId}
                className="w-full h-full"
                onClick={e => { e.stopPropagation(); onViewImage(scan.imageId) }}
              />
            </div>
            <div className="p-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: scan.format === 'table' ? '#EFF6FF' : '#F0FDF4',
                  color: scan.format === 'table' ? '#2563EB' : '#059669',
                }}>
                {scan.format === 'table' ? '표 형식' : '단어 목록'}
              </span>
              <p className="text-sm font-bold text-gray-800 mt-1">{scan.words.length}개 단어</p>
              <p className="text-xs text-gray-400 mt-0.5">탭하여 단어 보기</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 빈 화면 ─────────────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <button
        onClick={onAdd}
        className="px-10 py-3 text-white rounded-2xl font-bold text-base hover:opacity-90 transition-opacity shadow-sm"
        style={{ backgroundColor: '#E8694A' }}
      >
        추가
      </button>
    </div>
  )
}

// ─── 추가 메뉴 (사진찍기 / 가져오기) ─────────────────────────────
function AddMenu({ onCamera, onGallery, onClose }) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        style={{ bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 200 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onCamera}
          className="w-full px-5 py-4 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl">📷</span>
          <span className="text-sm font-medium text-gray-800">사진 찍기</span>
        </button>
        <div className="border-t border-gray-100" />
        <button
          onClick={onGallery}
          className="w-full px-5 py-4 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl">🖼️</span>
          <span className="text-sm font-medium text-gray-800">사진 가져오기</span>
        </button>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function VocabScanner({ onBack, nickname }) {
  const [scans, setScans] = useState([])
  const [selectedScan, setSelectedScan] = useState(null)
  const [sidebarMode, setSidebarMode] = useState('folders')
  const [sidebarDate, setSidebarDate] = useState(null)
  const [mainDate, setMainDate] = useState(null)
  const [viewingImageUrl, setViewingImageUrl] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const cameraRef = useRef()
  const galleryRef = useRef()

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
      const imageId = await idbSave(file)
      const today = getTodayISO()
      await addDoc(collection(db, 'vocab-scans'), {
        date: today, imageId,
        format: result.format, words: result.words,
        author: nickname || '익명', createdAt: serverTimestamp(),
      })
      setSidebarDate(today); setSidebarMode('files')
      setMainDate(today); setSelectedScan(null)
    } catch (err) {
      console.error(err); setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // 날짜 폴더 삭제
  const handleDeleteFolder = async (date, e) => {
    e.stopPropagation()
    if (!window.confirm(`${date} 폴더를 삭제하시겠습니까?`)) return
    await deleteScansForDate(scansByDate[date] || [])
    if (mainDate === date) { setMainDate(null); setSelectedScan(null) }
    if (sidebarDate === date) { setSidebarDate(null); setSidebarMode('folders') }
  }

  const handleViewImage = async (imageId) => {
    const blob = await idbGet(imageId)
    if (blob) setViewingImageUrl(URL.createObjectURL(blob))
    else setError('원본 이미지를 찾을 수 없습니다.')
  }
  const closeViewer = () => {
    if (viewingImageUrl) URL.revokeObjectURL(viewingImageUrl)
    setViewingImageUrl(null)
  }

  const mainScans = mainDate ? (scansByDate[mainDate] || []) : []

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">

      {/* 헤더 — 초기화면과 동일한 스타일 */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-xl p-2.5 transition hover:opacity-80"
            style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" stroke="#E8694A" strokeWidth="2"/>
            </svg>
          </button>
          <span className="text-sm font-bold" style={{ color: '#E8694A' }}>VOCAB BOOK</span>
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
        <div className="overflow-y-auto p-4" style={{ width: '75%' }}>
          {selectedScan ? (
            <VocabTable scan={selectedScan} onBack={() => setSelectedScan(null)} onViewImage={handleViewImage} />
          ) : mainDate && mainScans.length > 0 ? (
            <FileListView date={mainDate} scans={mainScans} onSelectScan={setSelectedScan} onViewImage={handleViewImage} />
          ) : (
            <EmptyState onAdd={() => setShowAddMenu(true)} />
          )}
        </div>

        {/* 우측 25% */}
        <div className="bg-white border-l border-gray-100 overflow-y-auto flex flex-col" style={{ width: '25%' }}>

          {/* 폴더 모드 */}
          {sidebarMode === 'folders' && (
            <>
              <p className="text-[9px] text-center text-gray-400 font-medium py-2">날짜 폴더</p>
              <div className="flex flex-col gap-1.5 px-2 pb-2">
                {sortedDates.length === 0 && (
                  <p className="text-[9px] text-center text-gray-300 mt-4 leading-relaxed">폴더 없음</p>
                )}
                {sortedDates.map(date => {
                  const [, m, d] = date.split('-')
                  const isSelected = mainDate === date
                  return (
                    <div key={date} className="relative">
                      {/* X 삭제 버튼 */}
                      <button
                        onClick={(e) => handleDeleteFolder(date, e)}
                        className="absolute top-1 left-1 z-10 w-4 h-4 rounded-full bg-gray-400 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                        style={{ fontSize: 9, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => { setSidebarDate(date); setSidebarMode('files'); setMainDate(date); setSelectedScan(null) }}
                        className={`w-full rounded-xl p-2 text-center transition-all border ${
                          isSelected ? 'border-[#E8694A] bg-[#FFF3F0]' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-lg">📁</div>
                        <div className="text-[10px] font-bold" style={{ color: isSelected ? '#E8694A' : '#374151' }}>{m}/{d}</div>
                        <div className="text-[9px] text-gray-400">{scansByDate[date].length}개</div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* 파일 모드 */}
          {sidebarMode === 'files' && sidebarDate && (
            <>
              <div className="px-2 py-2 border-b border-gray-100">
                <button onClick={() => setSidebarMode('folders')} className="text-[10px] text-gray-500 hover:text-gray-800 font-medium">← 폴더</button>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {(scansByDate[sidebarDate] || []).map((scan) => (
                  <div key={scan.id} className="flex flex-col gap-1">
                    <div
                      className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer border-2 hover:border-[#E8694A] transition-colors"
                      style={{ borderColor: selectedScan?.id === scan.id ? '#E8694A' : 'transparent' }}
                      onClick={() => { setMainDate(sidebarDate); setSelectedScan(scan) }}
                    >
                      <ThumbnailImage imageId={scan.imageId} className="w-full h-full" />
                    </div>
                    <button onClick={() => handleViewImage(scan.imageId)} className="text-[9px] text-gray-400 hover:text-gray-700 text-center">원본</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 추가 메뉴 */}
      {showAddMenu && (
        <AddMenu
          onCamera={() => { setShowAddMenu(false); cameraRef.current?.click() }}
          onGallery={() => { setShowAddMenu(false); galleryRef.current?.click() }}
          onClose={() => setShowAddMenu(false)}
        />
      )}

      {/* 숨겨진 파일 input — 카메라 */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {/* 숨겨진 파일 input — 갤러리 */}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

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
