import { useState, useEffect, useRef } from 'react'

const TABS = ['전체', '수학', '영어', '국어', '과학', '사회', '기타']

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

/* ── 미디어 선택 바텀시트 ── */
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
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 버튼 목록 */}
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

/* ── 업로드 메모 입력 시트 ── */
function UploadSheet({ file, dataURL, onClose, onSave }) {
  const [memo, setMemo] = useState('')
  const [tab, setTab] = useState('전체')
  const isVideo = file?.type?.startsWith('video/')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      {/* 미리보기 */}
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

      {/* 입력 영역 */}
      <div className="bg-white rounded-t-3xl px-5 pt-5 pb-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

        {/* 과목 탭 선택 */}
        <p className="text-xs font-bold text-gray-400 mb-2 tracking-wider uppercase">과목</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {TABS.filter(t => t !== '전체').map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{
                background: tab === t ? '#E8694A' : '#F5F5F5',
                color: tab === t ? 'white' : '#888',
              }}
            >{t}</button>
          ))}
        </div>

        {/* 메모 */}
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="메모를 입력하세요..."
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
          onClick={() => onSave({ memo, tab })}
        >
          저장 →
        </button>
      </div>
    </div>
  )
}

/* ── 미디어 카드 ── */
function MediaCard({ item, onDelete }) {
  const [showDelete, setShowDelete] = useState(false)
  const isVideo = item.mimeType?.startsWith('video/')

  return (
    <div
      className="relative aspect-square overflow-hidden rounded-xl bg-gray-100"
      onContextMenu={e => { e.preventDefault(); setShowDelete(true) }}
    >
      {isVideo ? (
        <video src={item.dataURL} className="w-full h-full object-cover" />
      ) : (
        <img src={item.dataURL} alt={item.memo || ''} className="w-full h-full object-cover" loading="lazy" />
      )}
      {isVideo && (
        <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      )}
      {item.tab && item.tab !== '전체' && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
          style={{ background: 'rgba(232,105,74,0.85)' }}>
          {item.tab}
        </div>
      )}
      {item.memo ? (
        <div className="absolute inset-x-0 bottom-0 px-2 py-1.5"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }}>
          <p className="text-white text-[11px] leading-tight line-clamp-2"
            style={{ fontFamily: 'Pretendard, sans-serif' }}>{item.memo}</p>
        </div>
      ) : null}

      {/* 삭제 팝업 */}
      {showDelete && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 rounded-xl">
          <button
            className="px-5 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: '#E8694A' }}
            onClick={() => { onDelete(item.id); setShowDelete(false) }}
          >삭제</button>
          <button
            className="px-5 py-2 rounded-xl text-sm font-bold text-gray-300"
            onClick={() => setShowDelete(false)}
          >취소</button>
        </div>
      )}
    </div>
  )
}

/* ── 메인 NotesPage ── */
export default function NotesPage({ onBack }) {
  const [media, setMedia] = useState([])
  const [activeTab, setActiveTab] = useState('전체')
  const [showPicker, setShowPicker] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingDataURL, setPendingDataURL] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllMedia().then(items => { setMedia(items); setLoading(false) })
  }, [])

  async function handlePick(file) {
    const dataURL = await fileToDataURL(file)
    setPendingFile(file)
    setPendingDataURL(dataURL)
  }

  async function handleSave({ memo, tab }) {
    const item = {
      dataURL: pendingDataURL,
      mimeType: pendingFile.type,
      memo,
      tab,
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
  }

  const filtered = activeTab === '전체' ? media : media.filter(m => m.tab === activeTab)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="flex-1 font-black text-lg text-gray-800" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            오답노트
          </h1>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-black text-[12px] tracking-widest"
            style={{
              background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)',
              boxShadow: '0 3px 14px rgba(232,105,74,0.40)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            ADD
          </button>
        </div>

        {/* 탭 스트립 */}
        <div className="flex gap-0 overflow-x-auto no-scrollbar border-t border-gray-50 px-2">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="flex-shrink-0 px-3.5 py-2.5 text-[12px] font-bold transition relative"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: activeTab === t ? '#E8694A' : '#AAA',
              }}
            >
              {t}
              {activeTab === t && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ background: '#E8694A' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 미디어 그리드 */}
      <div className="flex-1 max-w-lg mx-auto w-full px-1 pt-1 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-300 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: '#FFF3F0' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="13" y2="17"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm" style={{ fontFamily: 'Pretendard, sans-serif' }}>
              {activeTab === '전체' ? '아직 오답노트가 없어요' : `${activeTab} 오답노트가 없어요`}
            </p>
            <button
              onClick={() => setShowPicker(true)}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', fontFamily: 'JetBrains Mono, monospace' }}
            >+ ADD</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {filtered.map(item => (
              <MediaCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
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
    </div>
  )
}
