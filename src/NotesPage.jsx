import { useState, useEffect, useRef } from 'react'
import { db, storage } from './firebase'
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore'
import {
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage'

const SUBJECT_TABS = ['수학', '영어', '국어', '과학', '사회', '기타']
const NOTES_COL = 'notes-media'

// ── Firebase Storage 업로드 ──────────────────────────────────────
async function uploadFile(file) {
  const ext = file.name?.split('.').pop() || 'bin'
  const path = `notes/${Date.now()}.${ext}`
  const sRef = storageRef(storage, path)
  await uploadBytes(sRef, file)
  const url = await getDownloadURL(sRef)
  return { storagePath: path, storageURL: url }
}

// ── dataURL → Blob (UploadSheet 미리보기용) ───────────────────────
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
      <div className="relative bg-white rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="px-4 py-2 space-y-1">
          {[
            { ref: photoRef, capture: 'environment', label: '사진 찍기', icon: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></> },
            { ref: galleryRef, capture: undefined, label: '사진보관함', icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></> },
            { ref: fileRef, capture: undefined, label: '파일 선택', icon: <><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></> },
          ].map(({ ref, capture, label, icon }) => (
            <button key={label} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50 transition"
              onClick={() => ref.current.click()}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#FFF3F0' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              </div>
              <span className="text-base font-semibold text-gray-800">{label}</span>
            </button>
          ))}
          <input ref={photoRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleInput} />
          <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleInput} />
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleInput} />
        </div>
        <div className="px-4 pb-2">
          <button className="w-full py-3.5 rounded-2xl text-gray-500 font-semibold text-sm bg-gray-100 active:bg-gray-200 transition" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ── 업로드 시트 ───────────────────────────────────────────────────
function UploadSheet({ file, dataURL, uploading, onClose, onSave }) {
  const [memo, setMemo] = useState('')
  const [subject, setSubject] = useState('')
  const isVideo = file?.type?.startsWith('video/')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ background: '#111' }}>
        {isVideo
          ? <video src={dataURL} className="w-full h-full object-contain" controls />
          : <img src={dataURL} alt="" className="w-full h-full object-contain" />}
        <button className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} disabled={uploading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
        <p className="text-xs font-bold text-gray-400 mb-2 tracking-wider uppercase">과목</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {SUBJECT_TABS.map(t => (
            <button key={t} onClick={() => setSubject(subject === t ? '' : t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{ background: subject === t ? '#E8694A' : '#F5F5F5', color: subject === t ? 'white' : '#888' }}>
              {t}
            </button>
          ))}
        </div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="제목 또는 메모를 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
          style={{ border: '2px solid #F0EDE8', fontFamily: 'Pretendard, sans-serif' }}
          onFocus={e => { e.target.style.borderColor = '#E8694A' }}
          onBlur={e => { e.target.style.borderColor = '#F0EDE8' }}
        />
        <button
          className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-[13px] tracking-widest active:opacity-80 transition-all flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', boxShadow: '0 4px 18px rgba(232,105,74,0.38)', fontFamily: 'JetBrains Mono, monospace', opacity: uploading ? 0.7 : 1 }}
          onClick={() => onSave({ memo, subject })}
          disabled={uploading}>
          {uploading && (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          )}
          {uploading ? 'UPLOADING...' : '저장 →'}
        </button>
      </div>
    </div>
  )
}

// ── 전체화면 모달 ─────────────────────────────────────────────────
function FullscreenModal({ item, onClose }) {
  const isVideo = item.mimeType?.startsWith('video/')
  const src = item.storageURL
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
      {isVideo
        ? <video src={src} className="w-full h-full object-contain" controls autoPlay
            onClick={e => e.stopPropagation()} />
        : <img src={src} alt="" className="w-full h-full object-contain" />}
      <button className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm"
        onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ── 댓글 시트 ────────────────────────────────────────────────────
function CommentSheet({ item, onClose, onAddComment }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onAddComment(item.id, trimmed)
    setText('')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: '70vh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <p className="text-center text-sm font-black text-gray-800 pb-3 border-b border-gray-100 shrink-0"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          COMMENTS
        </p>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {(!item.comments || item.comments.length === 0) ? (
            <p className="text-center text-gray-400 text-sm py-6" style={{ fontFamily: 'Pretendard, sans-serif' }}>
              첫 댓글을 남겨보세요
            </p>
          ) : (
            item.comments.map(c => (
              <div key={c.id} className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#FFF3F0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8694A"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                  <p className="text-[13px] text-gray-800" style={{ fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}>
                    {c.text}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="댓글 달기..."
            className="flex-1 px-4 py-2.5 rounded-full text-sm text-gray-800 placeholder-gray-300 focus:outline-none"
            style={{ border: '1.5px solid #E5E7EB', fontFamily: 'Pretendard, sans-serif' }}
            onFocus={e => { e.target.style.borderColor = '#E8694A' }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition"
            style={{ background: text.trim() ? '#E8694A' : '#F3F4F6' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? 'white' : '#9CA3AF'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 롱프레스 컨텍스트 메뉴 (Delete / Edit / Close) ────────────────
function ContextMenuSheet({ onDelete, onEdit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="px-4 py-3 space-y-2">
          <button className="w-full py-4 rounded-2xl text-base font-bold text-white tracking-widest"
            style={{ background: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
            onClick={onDelete}>DELETE</button>
          <button className="w-full py-4 rounded-2xl text-base font-bold tracking-widest"
            style={{ background: '#F3F4F6', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}
            onClick={onEdit}>EDIT</button>
          <button className="w-full py-4 rounded-2xl text-base font-semibold tracking-widest"
            style={{ color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace' }}
            onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}

// ── 노트 수정 시트 ────────────────────────────────────────────────
function EditNoteSheet({ item, onClose, onSave }) {
  const [memo, setMemo] = useState(item.memo || '')
  const [subject, setSubject] = useState(item.subject || '')

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
        <p className="text-xs font-bold text-gray-400 mb-2 tracking-wider uppercase">Subject</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {SUBJECT_TABS.map(t => (
            <button key={t} onClick={() => setSubject(subject === t ? '' : t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{ background: subject === t ? '#E8694A' : '#F5F5F5', color: subject === t ? 'white' : '#888' }}>
              {t}
            </button>
          ))}
        </div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="제목 또는 메모를 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
          style={{ border: '2px solid #F0EDE8', fontFamily: 'Pretendard, sans-serif' }}
          onFocus={e => { e.target.style.borderColor = '#E8694A' }}
          onBlur={e => { e.target.style.borderColor = '#F0EDE8' }}
        />
        <button className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-[13px] tracking-widest active:opacity-80 transition-all"
          style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', boxShadow: '0 4px 18px rgba(232,105,74,0.38)', fontFamily: 'JetBrains Mono, monospace' }}
          onClick={() => onSave({ memo, subject })}>
          SAVE →
        </button>
      </div>
    </div>
  )
}

// ── 포스트 카드 ──────────────────────────────────────────────────
function PostCard({ item, isLiked, isBookmarked, shareCount, onToggleLike, onToggleBookmark, onShare, onOpenComments, onFullscreen, onLongPress }) {
  const isVideo = item.mimeType?.startsWith('video/')
  const pressTimer = useRef(null)
  const lastTapRef = useRef(0)
  const videoRef = useRef(null)

  // 비디오 자동재생 (muted, loop)
  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoRef.current?.play().catch(() => {})
        else videoRef.current?.pause()
      },
      { threshold: 0.3 }
    )
    observer.observe(videoRef.current)
    return () => observer.disconnect()
  }, [isVideo])

  // 롱프레스 → full item 전달
  function handlePointerDown() {
    pressTimer.current = setTimeout(() => onLongPress(item), 600)
  }
  function handlePointerUp() {
    clearTimeout(pressTimer.current)
  }

  // 이미지 더블탭 → 전체화면
  function handleImageTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      clearTimeout(pressTimer.current)
      onFullscreen(item)
    }
    lastTapRef.current = now
  }

  const commentCount = item.comments?.length || 0
  const src = item.storageURL

  return (
    <div className="border-b border-gray-100">
      {/* 이미지/영상 */}
      <div className="w-full bg-gray-100 relative" style={{ aspectRatio: '1 / 1' }}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={src}
            muted
            loop
            playsInline
            className="w-full h-full object-cover cursor-pointer"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onClick={() => onFullscreen(item)}
          />
        ) : (
          <img
            src={src}
            alt={item.memo || ''}
            className="w-full h-full object-cover cursor-pointer"
            loading="lazy"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onClick={handleImageTap}
          />
        )}
      </div>

      {/* 액션 아이콘 바 */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 active:scale-110 transition-transform" onClick={() => onToggleLike(item.id)}>
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill={isLiked ? '#E8694A' : 'none'}
              stroke={isLiked ? '#E8694A' : '#262626'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            {isLiked && (
              <span className="text-[12px] font-bold" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>1</span>
            )}
          </button>

          <button className="flex items-center gap-1 active:opacity-60 transition" onClick={() => onOpenComments(item)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            {commentCount > 0 && (
              <span className="text-[12px] font-bold text-gray-700" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{commentCount}</span>
            )}
          </button>

          <button className="flex items-center gap-1 active:opacity-60 transition" onClick={() => onShare(item.id)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {shareCount > 0 && (
              <span className="text-[12px] font-bold text-gray-700" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{shareCount}</span>
            )}
          </button>
        </div>

        <button className="active:scale-110 transition-transform" onClick={() => onToggleBookmark(item.id)}>
          <svg width="24" height="24" viewBox="0 0 24 24"
            fill={isBookmarked ? '#E8694A' : 'none'}
            stroke={isBookmarked ? '#E8694A' : '#262626'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>

      {/* 과목 · 제목 */}
      {(item.subject || item.memo) && (
        <div className="px-3 pt-0 pb-1.5">
          <p className="text-[13px] leading-snug text-gray-900"
            style={{ fontFamily: 'Pretendard, sans-serif', fontWeight: 700 }}>
            {item.subject && <span style={{ color: '#E8694A' }}>#{item.subject} </span>}
            {item.memo && <span>#{item.memo}</span>}
          </p>
        </div>
      )}

      {/* 댓글 미리보기 — 최대 2개 + ··· */}
      {item.comments && item.comments.length > 0 && (
        <div className="px-3 pb-3 space-y-0.5">
          {item.comments.slice(0, 2).map(c => (
            <p key={c.id} className="text-[12px] leading-snug truncate"
              style={{ fontFamily: 'Pretendard, sans-serif', color: '#374151' }}>
              <span className="font-bold" style={{ color: '#9CA3AF' }}>· </span>
              {c.text}
            </p>
          ))}
          {item.comments.length > 2 && (
            <p className="text-[11px] font-bold" style={{ color: '#D1D5DB', fontFamily: 'JetBrains Mono, monospace' }}>···</p>
          )}
        </div>
      )}
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
  const [uploading, setUploading] = useState(false)
  const [contextItem, setContextItem] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [fullscreenItem, setFullscreenItem] = useState(null)
  const [commentItem, setCommentItem] = useState(null)

  // 좋아요 / 즐겨찾기 → localStorage (기기 개인 취향)
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notes-liked') || '[]') } catch { return [] }
  })
  const [bookmarked, setBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notes-bookmarked') || '[]') } catch { return [] }
  })
  const [shares, setShares] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notes-shares') || '{}') } catch { return {} }
  })

  // Firestore 실시간 구독
  useEffect(() => {
    const q = query(collection(db, NOTES_COL), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  // commentItem을 media 변경에 맞춰 최신화
  useEffect(() => {
    if (!commentItem) return
    const updated = media.find(m => m.id === commentItem.id)
    if (updated) setCommentItem(updated)
  }, [media])

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

  function handleShare(id) {
    setShares(prev => {
      const next = { ...prev, [id]: (prev[id] || 0) + 1 }
      localStorage.setItem('notes-shares', JSON.stringify(next))
      return next
    })
  }

  // 댓글 추가 → Firestore 업데이트 (onSnapshot이 UI 반영)
  async function handleAddComment(id, text) {
    const newComment = { id: Date.now(), text, createdAt: Date.now() }
    const item = media.find(m => m.id === id)
    const updatedComments = [...(item?.comments || []), newComment]
    try {
      await updateDoc(doc(db, NOTES_COL, id), { comments: updatedComments })
    } catch {}
  }

  // 파일 선택
  async function handlePick(file) {
    const dataURL = await fileToDataURL(file)
    setPendingFile(file)
    setPendingDataURL(dataURL)
  }

  // 저장 → Firebase Storage 업로드 후 Firestore 저장
  async function handleSave({ memo, subject }) {
    if (!pendingFile) return
    setUploading(true)
    try {
      const { storagePath, storageURL } = await uploadFile(pendingFile)
      await addDoc(collection(db, NOTES_COL), {
        storagePath,
        storageURL,
        mimeType: pendingFile.type,
        memo,
        subject,
        comments: [],
        createdAt: Date.now(),
      })
      setPendingFile(null)
      setPendingDataURL(null)
    } catch (e) {
      console.error('upload error', e)
    } finally {
      setUploading(false)
    }
  }

  // 삭제 → Storage + Firestore
  async function handleDelete(item) {
    try {
      if (item.storagePath) {
        await deleteObject(storageRef(storage, item.storagePath))
      }
    } catch {}
    try {
      await deleteDoc(doc(db, NOTES_COL, item.id))
    } catch {}
    setContextItem(null)
  }

  // 수정 → Firestore
  async function handleEditSave({ memo, subject }) {
    try {
      await updateDoc(doc(db, NOTES_COL, editItem.id), { memo, subject })
    } catch {}
    setEditItem(null)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={onBack}
              className="flex items-center justify-center rounded-xl p-2.5 active:opacity-70"
              style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" stroke="#E8694A" strokeWidth="2"/>
              </svg>
            </button>
            <span className="text-sm font-black" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
              NOTE BOARD
            </span>
          </div>
          <button onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-[11px] font-black shadow-sm active:opacity-75"
            style={{ backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
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
            <button onClick={() => setShowPicker(true)}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', fontFamily: 'JetBrains Mono, monospace' }}>
              + ADD
            </button>
          </div>
        ) : (
          media.map(item => (
            <PostCard
              key={item.id}
              item={item}
              isLiked={liked.includes(item.id)}
              isBookmarked={bookmarked.includes(item.id)}
              shareCount={shares[item.id] || 0}
              onToggleLike={toggleLike}
              onToggleBookmark={toggleBookmark}
              onShare={handleShare}
              onOpenComments={setCommentItem}
              onFullscreen={setFullscreenItem}
              onLongPress={setContextItem}
            />
          ))
        )}
      </div>

      {/* 미디어 선택 */}
      {showPicker && (
        <MediaPickerSheet onClose={() => setShowPicker(false)} onPick={handlePick} />
      )}

      {/* 업로드 */}
      {pendingDataURL && (
        <UploadSheet
          file={pendingFile}
          dataURL={pendingDataURL}
          uploading={uploading}
          onClose={() => { if (!uploading) { setPendingFile(null); setPendingDataURL(null) } }}
          onSave={handleSave}
        />
      )}

      {/* 전체화면 */}
      {fullscreenItem && (
        <FullscreenModal item={fullscreenItem} onClose={() => setFullscreenItem(null)} />
      )}

      {/* 댓글 */}
      {commentItem && (
        <CommentSheet
          item={commentItem}
          onClose={() => setCommentItem(null)}
          onAddComment={handleAddComment}
        />
      )}

      {/* 롱프레스 컨텍스트 메뉴 */}
      {contextItem && (
        <ContextMenuSheet
          onDelete={() => handleDelete(contextItem)}
          onEdit={() => { setEditItem(contextItem); setContextItem(null) }}
          onClose={() => setContextItem(null)}
        />
      )}

      {/* 노트 수정 */}
      {editItem && (
        <EditNoteSheet
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  )
}
