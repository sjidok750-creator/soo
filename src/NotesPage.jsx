import { useState, useEffect, useRef } from 'react'

const SUBJECT_TABS = ['수학', '영어', '국어', '과학', '사회', '기타']

// ── IndexedDB ──────────────────────────────────────────────────────
const DB_NAME = 'notes-db'
const STORE_NAME = 'media'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('tab', 'tab', { unique: false })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}
async function saveMedia(item) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function getAllMedia() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result.reverse())
    req.onerror = () => reject(req.error)
  })
}
async function deleteMedia(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── 미디어 선택 바텀시트 ──────────────────────────────────────────
function MediaPickerSheet({ onClose, onPick }) {
  const photoRef = useRef(null)
  const galleryRef = useRef(null)
  const fileRef = useRef(null)

  function handleInput(e) {
    const file = e.target.files?.[0]
    if (file) onPick(file)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 py-2 space-y-1">
          <button
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50 transition"
            onClick={() => photoRef.current.click()}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#FFF3F0' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-800">사진 찍기</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleInput} />

          <button
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50 transition"
            onClick={() => galleryRef.current.click()}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#FFF3F0' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-800">사진보관함</span>
          </button>
          <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleInput} />

          <button
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50 transition"
            onClick={() => fileRef.current.click()}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#FFF3F0' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-800">파일 선택</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleInput} />
        </div>
        <div className="px-4 pb-2">
          <button
            className="w-full py-3.5 rounded-2xl text-gray-500 font-semibold text-sm bg-gray-100 active:bg-gray-200 transition"
            onClick={onClose}
          >취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 업로드 시트 ───────────────────────────────────────────────────
function UploadSheet({ file, dataURL, onClose, onSave }) {
  const [memo, setMemo] = useState('')
  const [subject, setSubject] = useState('')
  const isVideo = file?.type?.startsWith('video/')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ background: '#111' }}>
        {isVideo ? (
          <video src={dataURL} className="w-full h-full object-contain" controls />
        ) : (
          <img src={dataURL} alt="" className="w-full h-full object-contain" />
        )}
        <button
          className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="bg-white rounded-t-3xl px-5 pt-5 pb-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

        <p className="text-xs font-bold text-gray-400 mb-2 tracking-wider uppercase">과목</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {SUBJECT_TABS.map(t => (
            <button
              key={t}
              onClick={() => setSubject(subject === t ? '' : t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{
                background: subject === t ? '#E8694A' : '#F5F5F5',
                color: subject === t ? 'white' : '#888',
              }}
            >{t}</button>
          ))}
        </div>

        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="제목 또는 메모를 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
          style={{ border: '2px solid #F0EDE8', fontFamily: 'Pretendard, sans-serif' }}
          onFocus={e => { e.target.style.borderColor = '#E8694A' }}
          onBlur={e => { e.target.style.borderColor = '#F0EDE8' }}
        />

        <button
          className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-[13px] tracking-widest active:opacity-80 active:scale-[0.98] transition-all"
          style={{
            background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)',
            boxShadow: '0 4px 18px rgba(232,105,74,0.38)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          onClick={() => onSave({ memo, subject })}
        >
          저장 →
        </button>
      </div>
    </div>
  )
}

// ── 인스타그램 스타일 포스트 카드 ─────────────────────────────────
function PostCard({ item, liked, bookmarked, onToggleLike, onToggleBookmark, onLongPress }) {
  const isVideo = item.mimeType?.startsWith('video/')
  const pressTimer = useRef(null)

  function handleTouchStart() {
    pressTimer.current = setTimeout(() => onLongPress(item.id), 600)
  }
  function handleTouchEnd() {
    clearTimeout(pressTimer.current)
  }

  return (
    <div className="border-b border-gray-100">
      {/* 이미지 — 좌우 여백 없음, 정사각형 비율 */}
      <div
        className="w-full bg-gray-100 relative"
        style={{ aspectRatio: '1 / 1' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {isVideo ? (
          <video src={item.dataURL} className="w-full h-full object-cover" />
        ) : (
          <img src={item.dataURL} alt={item.memo || ''} className="w-full h-full object-cover" loading="lazy" />
        )}
        {isVideo && (
          <div className="absolute top-3 right-3 bg-black/50 rounded-full p-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        )}
      </div>

      {/* 액션 아이콘 바 */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-4">
          {/* 하트 */}
          <button onClick={() => onToggleLike(item.id)} className="active:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill={liked ? '#E8694A' : 'none'}
              stroke={liked ? '#E8694A' : '#262626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          {/* 댓글 */}
          <button className="active:opacity-60 transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </button>
          {/* 공유 */}
          <button className="active:opacity-60 transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        {/* 즐겨찾기 */}
        <button onClick={() => onToggleBookmark(item.id)} className="active:scale-110 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill={bookmarked ? '#262626' : 'none'}
            stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>

      {/* 과목 · 제목 */}
      <div className="px-3 pb-3">
        {item.subject && (
          <span
            className="inline-block text-[11px] font-black tracking-wider px-2 py-0.5 rounded-full mb-1"
            style={{ background: '#FFF3F0', color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
          >{item.subject}</span>
        )}
        {item.memo ? (
          <p className="text-[13px] text-gray-800 leading-snug" style={{ fontFamily: 'Pretendard, sans-serif' }}>
            {item.memo}
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ── 삭제 확인 바텀시트 ────────────────────────────────────────────
function DeleteSheet({ onDelete, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 py-3 space-y-2">
          <button
            className="w-full py-4 rounded-2xl text-base font-bold text-white"
            style={{ background: '#E8694A' }}
            onClick={onDelete}
          >삭제</button>
          <button
            className="w-full py-4 rounded-2xl text-base font-semibold text-gray-500 bg-gray-100"
            onClick={onCancel}
          >취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 NotesPage ────────────────────────────────────────────────
export default function NotesPage({ onBack }) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingDataURL, setPendingDataURL] = useState(null)
  const [deleteTargetId, setDeleteTargetId] = useState(null)

  // 좋아요 / 즐겨찾기 (localStorage)
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notes-liked') || '[]') } catch { return [] }
  })
  const [bookmarked, setBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notes-bookmarked') || '[]') } catch { return [] }
  })

  useEffect(() => {
    getAllMedia().then(items => { setMedia(items); setLoading(false) })
  }, [])

  function toggleLike(id) {
    setLiked(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('notes-liked', JSON.stringify(next))
      return next
    })
  }
  function toggleBookmark(id) {
    setBookmarked(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('notes-bookmarked', JSON.stringify(next))
      return next
    })
  }

  async function handlePick(file) {
    const dataURL = await fileToDataURL(file)
    setPendingFile(file)
    setPendingDataURL(dataURL)
  }

  async function handleSave({ memo, subject }) {
    const item = {
      dataURL: pendingDataURL,
      mimeType: pendingFile.type,
      memo,
      subject,
      createdAt: Date.now(),
    }
    await saveMedia(item)
    const updated = await getAllMedia()
    setMedia(updated)
    setPendingFile(null)
    setPendingDataURL(null)
  }

  async function handleDelete(id) {
    await deleteMedia(id)
    setMedia(prev => prev.filter(m => m.id !== id))
    setDeleteTargetId(null)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── 헤더 (TASK BOARD와 동일 스타일) ── */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center justify-center rounded-xl p-2.5 active:opacity-70"
              style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" stroke="#E8694A" strokeWidth="2"/>
              </svg>
            </button>
            <span
              className="text-sm font-black"
              style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
            >
              NOTE BOARD
            </span>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-[11px] font-black shadow-sm active:opacity-75"
            style={{ backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            +ADD
          </button>
        </div>
      </div>

      {/* ── 피드 ── */}
      <div className="flex-1 max-w-lg mx-auto w-full pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-300 text-sm">불러오는 중...</div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: '#FFF3F0' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm" style={{ fontFamily: 'Pretendard, sans-serif' }}>
              아직 오답노트가 없어요
            </p>
            <button
              onClick={() => setShowPicker(true)}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', fontFamily: 'JetBrains Mono, monospace' }}
            >+ ADD</button>
          </div>
        ) : (
          media.map(item => (
            <PostCard
              key={item.id}
              item={item}
              liked={liked.includes(item.id)}
              bookmarked={bookmarked.includes(item.id)}
              onToggleLike={toggleLike}
              onToggleBookmark={toggleBookmark}
              onLongPress={setDeleteTargetId}
            />
          ))
        )}
      </div>

      {/* 미디어 선택 시트 */}
      {showPicker && (
        <MediaPickerSheet
          onClose={() => setShowPicker(false)}
          onPick={handlePick}
        />
      )}

      {/* 업로드 시트 */}
      {pendingDataURL && (
        <UploadSheet
          file={pendingFile}
          dataURL={pendingDataURL}
          onClose={() => { setPendingFile(null); setPendingDataURL(null) }}
          onSave={handleSave}
        />
      )}

      {/* 삭제 확인 */}
      {deleteTargetId !== null && (
        <DeleteSheet
          onDelete={() => handleDelete(deleteTargetId)}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  )
}
