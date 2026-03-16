import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import PullToRefreshWrapper from './PullToRefreshWrapper'
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy,
} from 'firebase/firestore'

// ── 상수 ─────────────────────────────────────────────────────────────
const MONO = 'JetBrains Mono, monospace'
const CORAL = '#E8694A'
const CORAL_BG = '#FFF3F0'
const NOTES_COL = 'notes-media'
const SUBJECT_TABS = ['수학', '영어', '국어', '과학', '사회', '기타']

const SUBJECTS_NAV = [
  { key: '수학', abbr: 'M',   color: '#3B82F6', bg: '#EFF6FF' },
  { key: '국어', abbr: 'K',   color: '#EF4444', bg: '#FEF2F2' },
  { key: '영어', abbr: 'E',   color: '#10B981', bg: '#ECFDF5' },
  { key: '과학', abbr: 'Sc',  color: '#8B5CF6', bg: '#F5F3FF' },
  { key: '사회', abbr: 'So',  color: '#F59E0B', bg: '#FFFBEB' },
  { key: '기타', abbr: 'Etc', color: '#6B7280', bg: '#F9FAFB' },
]

// ── 이미지 압축 ──────────────────────────────────────────────────────
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
      let dataUrl = render(maxPx, quality)
      let q = quality
      while (dataUrl.length > MAX_BASE64_CHARS && q > 0.32) {
        q = Math.max(0.32, q - 0.1)
        dataUrl = render(maxPx, q)
      }
      if (dataUrl.length > MAX_BASE64_CHARS) dataUrl = render(600, 0.5)
      if (dataUrl.length > MAX_BASE64_CHARS) dataUrl = render(400, 0.4)
      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = obj
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

// ── 미디어 선택 바텀시트 (iPhone 액션시트 스타일) ─────────────────────
function MediaPickerSheet({ onClose, onPick }) {
  const photoRef = useRef(null)
  const galleryRef = useRef(null)
  const fileRef = useRef(null)

  function handleInput(e) {
    const files = Array.from(e.target.files || [])
    if (files.length) onPick(files)
    onClose()
  }

  const items = [
    {
      ref: photoRef,
      label: '사진 찍기',
      sub: '카메라로 바로 촬영',
      icon: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    },
    {
      ref: galleryRef,
      label: '사진보관함',
      sub: '여러 장 선택 가능',
      icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    },
    {
      ref: fileRef,
      label: '파일 선택',
      sub: '저장된 파일 불러오기',
      icon: <><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></>,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
      onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(6px)' }} />

      {/* 액션 카드 */}
      <div className="relative rounded-2xl overflow-hidden mb-3 bg-white/95" style={{ backdropFilter: 'blur(20px)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-2">
          <p className="text-center text-[10px] font-black tracking-widest" style={{ color: CORAL, fontFamily: MONO }}>
            NOTE BOARD
          </p>
        </div>
        {items.map(({ ref, label, sub, icon }, i) => (
          <button
            key={label}
            className="w-full flex items-center gap-4 px-5 py-4 active:bg-gray-100/80 transition"
            style={{ borderTop: i === 0 ? '1px solid rgba(0,0,0,0.07)' : 'none', borderBottom: '1px solid rgba(0,0,0,0.07)' }}
            onClick={() => ref.current.click()}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, #F5956A 0%, ${CORAL} 100%)` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
            </div>
            <div className="flex-1 text-left">
              <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: '#111827' }}>{label}</p>
              <p style={{ fontFamily: MONO, fontWeight: 500, fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{sub}</p>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInput} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInput} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInput} />
      </div>

      {/* 취소 버튼 (분리) */}
      <button
        className="relative w-full py-4 rounded-2xl font-black tracking-widest transition active:opacity-70"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', color: '#374151', fontFamily: MONO, fontSize: 13 }}
        onClick={onClose}
      >
        CANCEL
      </button>
    </div>
  )
}

// ── 업로드 시트 ────────────────────────────────────────────────────────
function UploadSheet({ files, dataURLs, uploading, onClose, onSave }) {
  const [memo, setMemo] = useState('')
  const [subject, setSubject] = useState('')
  const isMultiple = dataURLs.length > 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ background: '#111' }}>
        {isMultiple ? (
          <div className="w-full h-full overflow-y-auto p-1">
            <div className="grid grid-cols-3 gap-0.5">
              {dataURLs.map((url, i) => (
                <div key={i} className="relative" style={{ aspectRatio: '1/1' }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold" style={{ fontFamily: MONO }}>{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <img src={dataURLs[0]} alt="" className="w-full h-full object-contain" />
        )}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4">
          <button className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} disabled={uploading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          {isMultiple && (
            <div className="px-3 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: `rgba(232,105,74,0.85)`, fontFamily: MONO }}>
              {dataURLs.length}장 선택됨
            </div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
        <p className="text-[10px] font-black mb-2 tracking-wider" style={{ color: CORAL, fontFamily: MONO }}>SUBJECT</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {SUBJECT_TABS.map(t => (
            <button key={t} onClick={() => setSubject(subject === t ? '' : t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{
                background: subject === t ? CORAL : '#F5F5F5',
                color: subject === t ? 'white' : '#888',
                fontFamily: MONO,
              }}>
              {t}
            </button>
          ))}
        </div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="제목 또는 메모를 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
          style={{ border: '2px solid #F0EDE8', fontFamily: MONO, fontSize: 12 }}
          onFocus={e => { e.target.style.borderColor = CORAL }}
          onBlur={e => { e.target.style.borderColor = '#F0EDE8' }}
        />
        <button
          className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-[13px] tracking-widest active:opacity-80 transition-all flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, #F5956A 0%, ${CORAL} 100%)`, boxShadow: `0 4px 18px rgba(232,105,74,0.38)`, fontFamily: MONO, opacity: uploading ? 0.7 : 1 }}
          onClick={() => onSave({ memo, subject })}
          disabled={uploading}>
          {uploading && (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          )}
          {uploading ? 'UPLOADING...' : `저장 ${isMultiple ? `(${dataURLs.length}장)` : '→'}`}
        </button>
      </div>
    </div>
  )
}

// ── 전체화면 모달 ──────────────────────────────────────────────────────
function FullscreenModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
      <img src={item.imageUrl} alt="" className="w-full h-full object-contain" />
      <button className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm"
        onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ── 댓글 시트 ──────────────────────────────────────────────────────────
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
        <p className="text-center text-sm font-black pb-3 border-b border-gray-100 shrink-0"
          style={{ color: CORAL, fontFamily: MONO }}>
          COMMENTS
        </p>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {(!item.comments || item.comments.length === 0) ? (
            <p className="text-center text-sm py-6" style={{ color: '#9CA3AF', fontFamily: MONO, fontSize: 11 }}>
              첫 댓글을 남겨보세요
            </p>
          ) : (
            item.comments.map(c => (
              <div key={c.id} className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: CORAL_BG }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={CORAL}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                  <p className="text-[13px] text-gray-800" style={{ fontFamily: MONO, fontWeight: 500, fontSize: 11 }}>{c.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: MONO }}>
                    {new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="댓글 달기..."
            className="flex-1 px-4 py-2.5 rounded-full text-sm text-gray-800 placeholder-gray-300 focus:outline-none"
            style={{ border: '1.5px solid #E5E7EB', fontFamily: MONO, fontSize: 12 }}
            onFocus={e => { e.target.style.borderColor = CORAL }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
          />
          <button onClick={handleSubmit} disabled={!text.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition"
            style={{ background: text.trim() ? CORAL : '#F3F4F6' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? 'white' : '#9CA3AF'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 컨텍스트 메뉴 ──────────────────────────────────────────────────────
function ContextMenuSheet({ onDelete, onEdit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="px-4 py-3 space-y-2">
          <button className="w-full py-4 rounded-2xl text-base font-black text-white tracking-widest"
            style={{ background: CORAL, fontFamily: MONO }} onClick={onDelete}>DELETE</button>
          <button className="w-full py-4 rounded-2xl text-base font-bold tracking-widest"
            style={{ background: '#F3F4F6', color: '#374151', fontFamily: MONO }} onClick={onEdit}>EDIT</button>
          <button className="w-full py-4 rounded-2xl text-base font-semibold tracking-widest"
            style={{ color: '#9CA3AF', fontFamily: MONO }} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}

// ── 노트 수정 시트 ──────────────────────────────────────────────────────
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
        <p className="text-[10px] font-black mb-2 tracking-wider" style={{ color: CORAL, fontFamily: MONO }}>SUBJECT</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
          {SUBJECT_TABS.map(t => (
            <button key={t} onClick={() => setSubject(subject === t ? '' : t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{
                background: subject === t ? CORAL : '#F5F5F5',
                color: subject === t ? 'white' : '#888',
                fontFamily: MONO,
              }}>
              {t}
            </button>
          ))}
        </div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="제목 또는 메모를 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
          style={{ border: '2px solid #F0EDE8', fontFamily: MONO, fontSize: 12 }}
          onFocus={e => { e.target.style.borderColor = CORAL }}
          onBlur={e => { e.target.style.borderColor = '#F0EDE8' }}
        />
        <button className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-[13px] tracking-widest active:opacity-80"
          style={{ background: `linear-gradient(135deg, #F5956A 0%, ${CORAL} 100%)`, boxShadow: `0 4px 18px rgba(232,105,74,0.38)`, fontFamily: MONO }}
          onClick={() => onSave({ memo, subject })}>
          SAVE →
        </button>
      </div>
    </div>
  )
}

// ── 포스트 카드 ────────────────────────────────────────────────────────
function PostCard({ item, isLiked, isBookmarked, shareCount, onToggleLike, onToggleBookmark, onShare, onOpenComments, onFullscreen, onContextMenu }) {
  const lastTapRef = useRef(0)
  const singleTapTimer = useRef(null)

  function handleImageTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      clearTimeout(singleTapTimer.current)
      onContextMenu(item)
    } else {
      singleTapTimer.current = setTimeout(() => onFullscreen(item), 300)
    }
    lastTapRef.current = now
  }

  const commentCount = item.comments?.length || 0

  return (
    <div className="border-b border-gray-100">
      <div className="w-full bg-gray-100 relative" style={{ aspectRatio: '1 / 1' }}>
        <img src={item.imageUrl} alt={item.memo || ''}
          className="w-full h-full object-cover cursor-pointer" loading="lazy" onClick={handleImageTap} />
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <span className="text-white text-[9px]" style={{ fontFamily: MONO }}>2x tap to edit</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 active:scale-110 transition-transform" onClick={() => onToggleLike(item.id)}>
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill={isLiked ? CORAL : 'none'} stroke={isLiked ? CORAL : '#262626'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            {isLiked && <span className="text-[12px] font-bold" style={{ color: CORAL, fontFamily: MONO }}>1</span>}
          </button>
          <button className="flex items-center gap-1 active:opacity-60 transition" onClick={() => onOpenComments(item)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            {commentCount > 0 && <span className="text-[12px] font-bold text-gray-700" style={{ fontFamily: MONO }}>{commentCount}</span>}
          </button>
          <button className="flex items-center gap-1 active:opacity-60 transition" onClick={() => onShare(item.id)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {shareCount > 0 && <span className="text-[12px] font-bold text-gray-700" style={{ fontFamily: MONO }}>{shareCount}</span>}
          </button>
        </div>
        <button className="active:scale-110 transition-transform" onClick={() => onToggleBookmark(item.id)}>
          <svg width="24" height="24" viewBox="0 0 24 24"
            fill={isBookmarked ? CORAL : 'none'} stroke={isBookmarked ? CORAL : '#262626'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>
      {(item.subject || item.memo) && (
        <div className="px-3 pt-0 pb-1.5">
          <p className="text-[13px] leading-snug text-gray-900" style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11 }}>
            {item.subject && <span style={{ color: CORAL }}>#{item.subject} </span>}
            {item.memo && <span style={{ color: '#374151' }}>{item.memo}</span>}
          </p>
        </div>
      )}
      {item.comments && item.comments.length > 0 && (
        <div className="px-3 pb-3 space-y-0.5">
          {item.comments.slice(0, 2).map(c => (
            <p key={c.id} className="text-[11px] leading-snug truncate" style={{ fontFamily: MONO, color: '#374151' }}>
              <span className="font-bold" style={{ color: '#9CA3AF' }}>· </span>{c.text}
            </p>
          ))}
          {item.comments.length > 2 && (
            <p className="text-[10px] font-bold" style={{ color: '#D1D5DB', fontFamily: MONO }}>···</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── 썸네일 카드 (과목 필터 뷰) ───────────────────────────────────────
function ThumbCard({ item, onFullscreen, onContextMenu }) {
  const lastTapRef = useRef(0)
  const timerRef = useRef(null)

  function handleTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      clearTimeout(timerRef.current)
      onContextMenu(item)
    } else {
      timerRef.current = setTimeout(() => onFullscreen(item), 300)
    }
    lastTapRef.current = now
  }

  return (
    <div
      className="relative overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
      style={{ aspectRatio: '1/1', backgroundColor: '#F3F4F6' }}
      onClick={handleTap}
    >
      <img src={item.imageUrl} alt={item.memo || ''} className="w-full h-full object-cover" loading="lazy" />
      {item.memo && (
        <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1 pt-3"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}>
          <p className="text-white truncate leading-tight" style={{ fontFamily: MONO, fontSize: 8 }}>{item.memo}</p>
        </div>
      )}
    </div>
  )
}

// ── 과목 사이드바 아이콘 ──────────────────────────────────────────────
const GOTHIC = "'Arial Black', 'Arial Bold', Impact, 'Haettenschweiler', sans-serif"

function SubjectIcon({ subject, isActive, onClick }) {
  const abbrLen = subject.abbr.length
  const fontSize = abbrLen === 1 ? 17 : abbrLen === 2 ? 13 : 10

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 w-full py-1 transition-all active:scale-90"
    >
      <div
        className="rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          width: 40, height: 40,
          backgroundColor: CORAL,
          boxShadow: isActive ? `0 3px 12px rgba(232,105,74,0.55)` : `0 1px 4px rgba(232,105,74,0.22)`,
          outline: isActive ? `2.5px solid rgba(232,105,74,0.45)` : 'none',
          outlineOffset: isActive ? 2 : 0,
          opacity: isActive ? 1 : 0.72,
          transform: isActive ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontFamily: GOTHIC,
            fontWeight: 900,
            fontSize,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            textShadow: '0 1px 2px rgba(0,0,0,0.18)',
          }}
        >
          {subject.abbr}
        </span>
      </div>
      <span
        style={{
          color: isActive ? CORAL : '#CBD5E1',
          fontFamily: MONO,
          fontWeight: isActive ? 800 : 500,
          fontSize: 6.5,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {subject.key}
      </span>
    </button>
  )
}

// ── 메인 NotesPage ─────────────────────────────────────────────────────
export default function NotesPage({ onBack }) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [pendingDataURLs, setPendingDataURLs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [contextItem, setContextItem] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [fullscreenItem, setFullscreenItem] = useState(null)
  const [commentItem, setCommentItem] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)

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
    const unsub = onSnapshot(q,
      snap => { setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  // commentItem 최신화
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
  async function handleAddComment(id, text) {
    const item = media.find(m => m.id === id)
    const updatedComments = [...(item?.comments || []), { id: Date.now(), text, createdAt: Date.now() }]
    try { await updateDoc(doc(db, NOTES_COL, id), { comments: updatedComments }) } catch {}
  }
  async function handlePick(files) {
    const dataURLs = await Promise.all(files.map(fileToDataURL))
    setPendingFiles(files)
    setPendingDataURLs(dataURLs)
  }
  async function handleSave({ memo, subject }) {
    if (!pendingFiles.length) return
    setUploading(true)
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const imageUrl = await compressImage(pendingFiles[i])
        await addDoc(collection(db, NOTES_COL), { imageUrl, memo, subject, comments: [], createdAt: Date.now() + i })
      }
      setPendingFiles([]); setPendingDataURLs([])
    } catch (e) { console.error('save error', e) }
    finally { setUploading(false) }
  }
  async function handleDelete(item) {
    try { await deleteDoc(doc(db, NOTES_COL, item.id)) } catch {}
    setContextItem(null)
  }
  async function handleEditSave({ memo, subject }) {
    try { await updateDoc(doc(db, NOTES_COL, editItem.id), { memo, subject }) } catch {}
    setEditItem(null)
  }

  const displayMedia = selectedSubject
    ? media.filter(m => m.subject === selectedSubject)
    : media

  const activeMeta = SUBJECTS_NAV.find(s => s.key === selectedSubject)

  return (
    <div
      className="flex flex-col bg-white"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* ── 헤더 ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b border-gray-100"
        style={{ height: 52, backgroundColor: '#FAFAFA' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-xl active:opacity-70 transition-opacity"
            style={{ width: 34, height: 34, border: `2px solid ${CORAL}`, backgroundColor: CORAL_BG }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" stroke={CORAL} strokeWidth="2.5"/>
            </svg>
          </button>
          <span className="font-black tracking-widest" style={{ color: CORAL, fontFamily: MONO, fontSize: 11 }}>
            NOTE BOARD
          </span>
        </div>

        {/* 활성 과목 태그 (탭하면 해제) */}
        {selectedSubject && activeMeta && (
          <button
            onClick={() => setSelectedSubject(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full transition-all active:scale-95"
            style={{
              backgroundColor: activeMeta.bg,
              border: `1.5px solid ${activeMeta.color}`,
            }}
          >
            <span style={{ color: activeMeta.color, fontFamily: MONO, fontWeight: 800, fontSize: 9 }}>
              #{selectedSubject}
            </span>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
              stroke={activeMeta.color} strokeWidth="3" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}

        {/* 전체 카운트 */}
        {!selectedSubject && media.length > 0 && (
          <span style={{ color: '#CBD5E1', fontFamily: MONO, fontSize: 9 }}>
            {media.length} notes
          </span>
        )}
      </div>

      {/* ── 바디: 사이드바 + 메인 패널 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌측 과목 사이드바 (15%) ── */}
        <div
          className="flex-shrink-0 flex flex-col items-center py-3 border-r border-gray-100"
          style={{ width: '15%', backgroundColor: '#FAFAFA' }}
        >
          {/* 과목 아이콘 목록 */}
          <div className="flex flex-col items-center gap-1 w-full px-1">
            {SUBJECTS_NAV.map(s => (
              <SubjectIcon
                key={s.key}
                subject={s}
                isActive={selectedSubject === s.key}
                onClick={() => setSelectedSubject(selectedSubject === s.key ? null : s.key)}
              />
            ))}
          </div>

          {/* 스페이서 */}
          <div className="flex-1" />

          {/* +ADD 버튼 */}
          <button
            onClick={() => setShowPicker(true)}
            className="flex flex-col items-center gap-0.5 w-full px-1 py-2 active:scale-90 transition-all"
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 40, height: 40,
                background: `linear-gradient(135deg, #F5956A 0%, ${CORAL} 100%)`,
                boxShadow: `0 4px 14px rgba(232,105,74,0.45)`,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <span style={{ color: CORAL, fontFamily: MONO, fontWeight: 900, fontSize: 7, letterSpacing: '0.05em' }}>
              ADD
            </span>
          </button>
        </div>

        {/* ── 우측 메인 패널 (85%) — PTR로 첫화면 복귀 ── */}
        <PullToRefreshWrapper onRefresh={() => setSelectedSubject(null)} bg="#fff" style={{ flex: 1, overflow: 'hidden' }}>
        <div className="flex-1 overflow-y-auto bg-white" style={{ minHeight: '100%' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span style={{ color: '#CBD5E1', fontFamily: MONO, fontSize: 9 }}>loading...</span>
              </div>
            </div>
          ) : displayMedia.length === 0 ? (
            /* 빈 상태 */
            <div className="flex flex-col items-center justify-center h-full gap-3 pb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: CORAL_BG }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <p style={{ color: CORAL, fontFamily: MONO, fontWeight: 800, fontSize: 11 }}>
                {selectedSubject ? `${selectedSubject} 자료 없음` : '노트가 없어요'}
              </p>
              {!selectedSubject && (
                <button
                  onClick={() => setShowPicker(true)}
                  className="px-4 py-2 rounded-xl text-white font-black tracking-wider active:opacity-80"
                  style={{ background: `linear-gradient(135deg, #F5956A 0%, ${CORAL} 100%)`, fontFamily: MONO, fontSize: 10 }}
                >
                  +ADD
                </button>
              )}
            </div>
          ) : selectedSubject ? (
            /* 썸네일 그리드 뷰 */
            <div className="grid gap-0.5 p-0.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {displayMedia.map(item => (
                <ThumbCard
                  key={item.id}
                  item={item}
                  onFullscreen={setFullscreenItem}
                  onContextMenu={setContextItem}
                />
              ))}
            </div>
          ) : (
            /* 피드 뷰 (전체) */
            <div className="pb-4">
              {displayMedia.map(item => (
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
                  onContextMenu={setContextItem}
                />
              ))}
            </div>
          )}
        </div>
        </PullToRefreshWrapper>
      </div>

      {/* ── 오버레이 ── */}
      {showPicker && <MediaPickerSheet onClose={() => setShowPicker(false)} onPick={handlePick} />}
      {pendingDataURLs.length > 0 && (
        <UploadSheet
          files={pendingFiles} dataURLs={pendingDataURLs} uploading={uploading}
          onClose={() => { if (!uploading) { setPendingFiles([]); setPendingDataURLs([]) } }}
          onSave={handleSave}
        />
      )}
      {fullscreenItem && <FullscreenModal item={fullscreenItem} onClose={() => setFullscreenItem(null)} />}
      {commentItem && (
        <CommentSheet item={commentItem} onClose={() => setCommentItem(null)} onAddComment={handleAddComment} />
      )}
      {contextItem && (
        <ContextMenuSheet
          onDelete={() => handleDelete(contextItem)}
          onEdit={() => { setEditItem(contextItem); setContextItem(null) }}
          onClose={() => setContextItem(null)}
        />
      )}
      {editItem && <EditNoteSheet item={editItem} onClose={() => setEditItem(null)} onSave={handleEditSave} />}
    </div>
  )
}
