import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, doc, deleteDoc
} from 'firebase/firestore'

// ─── IndexedDB helpers (이미지 로컬 저장) ─────────────────────────
const IDB_NAME = 'studybuddy-vocab-imgs'
const IDB_VER = 1
const IDB_STORE = 'images'

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSave(blob) {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).add({ blob, savedAt: Date.now() })
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

// ─── Claude API (이미지 분석) ─────────────────────────────────────
async function analyzeVocabImage(base64, mediaType) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.')
  }

  const prompt = `당신은 영어 단어장/교재 이미지에서 단어와 뜻을 정확하게 추출하는 전문가입니다.

이 이미지를 분석하여 아래 두 케이스 중 하나로 처리해주세요:

[케이스 1 - 표 형식 (format: "table")]
이미지에 No/Word/Meaning 등의 표가 있는 경우:
- 파란색 선으로 표시된 Word 열의 영단어 추출
- 빨간색 선으로 표시된 Meaning 열의 한국어 뜻 추출
- 표에 있는 모든 단어-뜻 쌍을 순서대로 빠짐없이 추출
- 표에 번호(01, 02...)가 있으면 그 순서 유지

[케이스 2 - 단어 목록 형식 (format: "wordlist")]
이미지에 체크박스(□)와 함께 영단어 목록이 나열된 경우:
- 빨간색 사각형 테두리 안의 영단어들만 추출
- 각 영단어의 가장 대표적인 한국어 뜻 2가지를 쉼표로 구분하여 제공
- 예시: "stimulate" → "자극하다, 촉진하다"
- 단어 목록이 여러 열로 나뉘어 있으면 모두 추출

반드시 아래 JSON 형식으로만 응답 (마크다운 블록 없이 순수 JSON):
{"format":"table","words":[{"word":"praise","meaning":"칭송하다"},{"word":"exhausting","meaning":"소모적인"}]}

또는

{"format":"wordlist","words":[{"word":"stimulate","meaning":"자극하다, 촉진하다"},{"word":"ritual","meaning":"의식, 의례"}]}

주의:
- JSON 외 다른 텍스트 절대 포함 금지
- 이미지에서 보이는 단어를 최대한 정확하게 인식
- 단어 순서는 이미지에 나타난 순서 유지
- 이미지가 흐릿해도 최선을 다해 인식`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    throw new Error(errData.error?.message || `API 오류 (${resp.status})`)
  }

  const data = await resp.json()
  let text = data.content[0].text.trim()
  // Remove markdown code blocks if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  return JSON.parse(text)
}

// ─── 날짜 포맷 ────────────────────────────────────────────────────
function getTodayISO() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function formatDateKo(iso) {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${m}월 ${d}일`
}

// ─── ThumbnailImage ───────────────────────────────────────────────
function ThumbnailImage({ imageId, onClick, className = '' }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objUrl
    idbGet(imageId).then(blob => {
      if (blob) {
        objUrl = URL.createObjectURL(blob)
        setUrl(objUrl)
      }
    })
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [imageId])

  if (!url) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-2xl opacity-40">📷</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="스캔 이미지"
      className={`object-cover cursor-pointer ${className}`}
      onClick={onClick}
    />
  )
}

// ─── DateFolder (우측 사이드바 아이템) ───────────────────────────
function DateFolder({ date, scans, selected, onClick }) {
  const [, m, d] = date.split('-')
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl p-2 text-center transition-all border ${
        selected
          ? 'border-[#E8694A] bg-[#FFF3F0]'
          : 'border-gray-100 bg-white hover:bg-gray-50'
      }`}
    >
      {/* 첫 번째 이미지 썸네일 */}
      <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5">
        <ThumbnailImage
          imageId={scans[0]?.imageId}
          className="w-full h-full"
        />
      </div>
      <div
        className="text-[10px] font-bold leading-tight"
        style={{ color: selected ? '#E8694A' : '#374151' }}
      >
        {m}/{d}
      </div>
      <div className="text-[9px] text-gray-400 mt-0.5">{scans.length}개</div>
    </button>
  )
}

// ─── VocabTable (단어 표) ─────────────────────────────────────────
function VocabTable({ scan, onBack, onViewImage }) {
  const [revealedMap, setRevealedMap] = useState({})
  const allRevealed = scan.words.every((_, i) => revealedMap[i])

  const toggleWord = (i) => {
    setRevealedMap(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const toggleAll = () => {
    if (allRevealed) {
      setRevealedMap({})
    } else {
      const m = {}
      scan.words.forEach((_, i) => { m[i] = true })
      setRevealedMap(m)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* 상단 컨트롤 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          ← 목록
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">{formatDateKo(scan.date)} · {scan.format === 'table' ? '표 형식' : '단어 목록'}</p>
          <p className="text-sm font-bold text-gray-800 truncate">{scan.words.length}개 단어</p>
        </div>
        {scan.imageId && (
          <button
            onClick={() => onViewImage(scan.imageId)}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
          >
            📷 원본
          </button>
        )}
        <button
          onClick={toggleAll}
          className="px-3 py-1.5 text-xs rounded-xl transition-colors font-medium"
          style={{ backgroundColor: '#FFF3F0', color: '#E8694A', border: '1px solid #FECDBB' }}
        >
          {allRevealed ? '모두 숨기기' : '모두 보기'}
        </button>
      </div>

      {/* 단어 표 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        {/* 헤더 */}
        <div className="grid grid-cols-2 bg-gray-800 text-white">
          <div className="px-4 py-3 text-sm font-semibold">Word</div>
          <div className="px-4 py-3 text-sm font-semibold">Meaning</div>
        </div>
        {/* 단어 행 */}
        {scan.words.map((item, i) => (
          <div
            key={i}
            className={`grid grid-cols-2 border-b border-gray-50 last:border-0 ${
              i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
            }`}
          >
            <div className="px-4 py-3 text-sm font-medium text-gray-800 flex items-center">
              <span className="text-gray-300 text-xs mr-2 w-5 text-right shrink-0">{i + 1}</span>
              {item.word}
            </div>
            <div
              className="px-4 py-3 flex items-center cursor-pointer select-none"
              onClick={() => toggleWord(i)}
            >
              {revealedMap[i] ? (
                <span className="text-sm font-medium" style={{ color: '#0D9488' }}>{item.meaning}</span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ backgroundColor: '#F0FDFA', color: '#0D9488', border: '1px solid #CCFBF1' }}
                >
                  탭하여 확인
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-3">뜻 영역을 탭하면 정답이 보입니다</p>
    </div>
  )
}

// ─── FolderView (날짜별 스캔 목록) ───────────────────────────────
function FolderView({ date, scans, onSelectScan, onBack, onViewImage }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          ← 폴더
        </button>
        <div>
          <p className="text-xs text-gray-400">날짜 폴더</p>
          <p className="text-sm font-bold text-gray-800">{formatDateKo(date)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {scans.map((scan) => (
          <div
            key={scan.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
            onClick={() => onSelectScan(scan)}
          >
            {/* 썸네일 */}
            <div className="h-36 overflow-hidden bg-gray-50">
              <ThumbnailImage
                imageId={scan.imageId}
                className="w-full h-full"
                onClick={(e) => { e.stopPropagation(); onViewImage(scan.imageId) }}
              />
            </div>
            {/* 정보 */}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: scan.format === 'table' ? '#EFF6FF' : '#F0FDF4',
                    color: scan.format === 'table' ? '#2563EB' : '#059669',
                  }}
                >
                  {scan.format === 'table' ? '표 형식' : '단어 목록'}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-800">{scan.words.length}개 단어</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{scan.author}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────
function EmptyState({ onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-5 px-4">
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-sm"
        style={{ backgroundColor: '#FFF3F0' }}>
        📸
      </div>
      <div>
        <p className="text-lg font-bold text-gray-800">단어장 사진을 추가해보세요!</p>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          AI가 사진에서 단어와 뜻을 자동으로 인식합니다.<br />
          표 형식과 단어 목록 형식 모두 지원합니다.
        </p>
      </div>
      <button
        onClick={onUpload}
        className="px-8 py-3.5 text-white rounded-2xl font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#E8694A' }}
      >
        📷 사진 추가하기
      </button>
      <div className="text-xs text-gray-400 space-y-1">
        <p>📋 케이스 1: 단어+뜻이 있는 표 형식 → 뜻 자동 추출</p>
        <p>📝 케이스 2: 단어 목록만 있는 형식 → AI가 뜻 자동 생성</p>
      </div>
    </div>
  )
}

// ─── Main: VocabScanner ───────────────────────────────────────────
export default function VocabScanner({ onBack, nickname }) {
  const [scans, setScans] = useState([])
  const [selectedScan, setSelectedScan] = useState(null)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [viewingImageUrl, setViewingImageUrl] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef()

  // Firestore 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'vocab-scans'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setScans(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, (err) => {
      console.error('vocab-scans read error:', err)
      setError(`데이터 로드 실패: ${err.code}`)
    })
  }, [])

  // 날짜별 그룹핑
  const scansByDate = scans.reduce((acc, scan) => {
    if (!acc[scan.date]) acc[scan.date] = []
    acc[scan.date].push(scan)
    return acc
  }, {})
  const sortedDates = Object.keys(scansByDate).sort((a, b) => b.localeCompare(a))

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setAnalyzing(true)
    setError('')

    try {
      // 이미지 → base64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = (ev) => res(ev.target.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'image/jpeg'

      // Claude API로 단어 분석
      const result = await analyzeVocabImage(base64, mediaType)

      if (!result.words || result.words.length === 0) {
        throw new Error('이미지에서 단어를 찾을 수 없습니다. 다른 사진을 시도해주세요.')
      }

      // 이미지 IndexedDB에 저장
      const imageId = await idbSave(file)

      // Firestore에 메타데이터 저장
      const today = getTodayISO()
      await addDoc(collection(db, 'vocab-scans'), {
        date: today,
        imageId,
        format: result.format,
        words: result.words,
        author: nickname || '익명',
        fileName: file.name,
        wordCount: result.words.length,
        createdAt: serverTimestamp(),
      })

      setSelectedFolder(today)
      setSelectedScan(null)
    } catch (err) {
      console.error('analyzeVocabImage error:', err)
      setError(err.message || '이미지 분석에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleViewImage = async (imageId) => {
    const blob = await idbGet(imageId)
    if (blob) {
      const url = URL.createObjectURL(blob)
      setViewingImageUrl(url)
    } else {
      setError('원본 이미지를 찾을 수 없습니다. (이 기기에서 스캔한 파일만 볼 수 있습니다)')
    }
  }

  const closeImageViewer = () => {
    if (viewingImageUrl) URL.revokeObjectURL(viewingImageUrl)
    setViewingImageUrl(null)
  }

  const handleDeleteScan = async (scanId) => {
    if (!window.confirm('이 스캔을 삭제하시겠습니까?')) return
    await deleteDoc(doc(db, 'vocab-scans', scanId))
    if (selectedScan?.id === scanId) setSelectedScan(null)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col pb-0">

      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">📸 단어 스캐너</h1>
          <p className="text-xs text-gray-400">사진으로 단어 자동 인식</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className="px-4 py-2 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-opacity hover:opacity-90 shadow-sm"
          style={{ backgroundColor: '#E8694A' }}
        >
          {analyzing ? '⏳ 분석 중...' : '+ 사진 추가'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <span className="text-red-500 shrink-0">⚠️</span>
          <span className="text-red-700 text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedScan ? (
            <VocabTable
              scan={selectedScan}
              onBack={() => setSelectedScan(null)}
              onViewImage={handleViewImage}
            />
          ) : selectedFolder && scansByDate[selectedFolder] ? (
            <FolderView
              date={selectedFolder}
              scans={scansByDate[selectedFolder]}
              onSelectScan={setSelectedScan}
              onBack={() => { setSelectedFolder(null); setSelectedScan(null) }}
              onViewImage={handleViewImage}
            />
          ) : (
            <EmptyState onUpload={() => fileInputRef.current?.click()} />
          )}
        </div>

        {/* 우측 날짜 폴더 사이드바 */}
        {sortedDates.length > 0 && (
          <div className="w-[72px] bg-white border-l border-gray-100 overflow-y-auto flex flex-col gap-2 p-2">
            <p className="text-[9px] text-center text-gray-400 font-medium py-0.5">날짜</p>
            {sortedDates.map(date => (
              <DateFolder
                key={date}
                date={date}
                scans={scansByDate[date]}
                selected={selectedFolder === date && !selectedScan}
                onClick={() => { setSelectedFolder(date); setSelectedScan(null) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 분석 중 오버레이 */}
      {analyzing && (
        <div className="fixed inset-0 bg-white/90 z-50 flex flex-col items-center justify-center gap-5">
          <div className="w-14 h-14 border-4 border-gray-200 rounded-full animate-spin"
            style={{ borderTopColor: '#E8694A' }} />
          <div className="text-center">
            <p className="text-gray-800 font-bold text-base">AI가 단어를 인식 중...</p>
            <p className="text-gray-500 text-sm mt-1">잠시만 기다려 주세요</p>
          </div>
        </div>
      )}

      {/* 원본 이미지 뷰어 */}
      {viewingImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeImageViewer}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl transition-colors"
            onClick={closeImageViewer}
          >
            ✕
          </button>
          <img
            src={viewingImageUrl}
            alt="원본 이미지"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
