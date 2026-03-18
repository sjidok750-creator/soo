import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, query, onSnapshot, orderBy,
  serverTimestamp, doc, deleteDoc, updateDoc,
} from 'firebase/firestore'
import { DAILY_SUBJECTS, getDailySubject } from './subjectConfig'
import PullToRefreshWrapper from './PullToRefreshWrapper'

// ─── 카테고리 ─────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'school',     label: 'School',     bg: '#FFE4E6', border: '#FECDD3', text: '#BE123C' },
  { id: 'tutoring',   label: 'Tutoring',   bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },
  { id: 'coursework', label: 'Coursework', bg: '#EDE9FE', border: '#DDD6FE', text: '#6D28D9' },
  { id: 'other',      label: 'Other',      bg: '#F3F4F6', border: '#E5E7EB', text: '#4B5563' },
]
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

// ─── IndexedDB (첨부파일) ─────────────────────────────────────────
const IDB_NAME = 'studybuddy-task-files'
const IDB_STORE = 'files'

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = e =>
      e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}
async function idbSave(blob) {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).add({ blob })
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
    tx.oncomplete = () => idb.close()
  })
}
async function idbGet(id) {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx  = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(Number(id))
    req.onsuccess = () => resolve(req.result?.blob || null)
    req.onerror   = () => reject(req.error)
    tx.oncomplete = () => idb.close()
  })
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────
function getTodayISO() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
function fmtViewDate(iso) {
  const today = getTodayISO()
  if (iso === today) return 'TODAY'
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const d = new Date(iso + 'T12:00:00')
  const [, m, day] = iso.split('-')
  return `${parseInt(m)}/${parseInt(day)} ${DAYS[d.getDay()]}`
}
function fmtShort(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
function getTaskDate(task) {
  if (task.taskDate) return task.taskDate
  if (task.createdAt?.seconds) {
    const d = new Date(task.createdAt.seconds * 1000)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  return getTodayISO()
}

// ─── 날짜 탭 스트립 ───────────────────────────────────────────────
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function DateTabStrip({ viewDate, tasks, onSelect }) {
  const today    = getTodayISO()
  const scrollRef = useRef()

  // today ±7 = 15 tabs
  const dates = Array.from({ length: 15 }, (_, i) => addDays(today, i - 7))

  // task count per date (dot indicator)
  const countByDate = tasks.reduce((acc, t) => {
    const d = getTaskDate(t); acc[d] = (acc[d] || 0) + 1; return acc
  }, {})

  // auto-scroll active tab to center
  useEffect(() => {
    if (!scrollRef.current) return
    const active = scrollRef.current.querySelector('[data-active="true"]')
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [viewDate])

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto gap-1.5 px-3 py-2.5"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {dates.map(iso => {
        const d = new Date(iso + 'T12:00:00')
        const dayNum  = parseInt(iso.split('-')[2])
        const isSelected = iso === viewDate
        const isToday    = iso === today
        const hasTasks   = !!countByDate[iso]
        const isPast     = iso < today

        return (
          <button
            key={iso}
            data-active={String(isSelected)}
            onClick={() => onSelect(iso)}
            className="flex flex-col items-center flex-shrink-0 rounded-2xl transition-all active:scale-95"
            style={{
              minWidth: isToday ? 46 : 38,
              padding: isToday ? '7px 6px 5px' : '6px 5px 4px',
              backgroundColor: isSelected ? '#E8694A' : isToday ? '#FFF3F0' : '#F9FAFB',
              border: `1.5px solid ${isSelected ? '#E8694A' : isToday ? '#FECDC5' : '#E5E7EB'}`,
              opacity: isPast && !isSelected && !hasTasks ? 0.5 : 1,
            }}
          >
            <span
              className="text-[8px] font-bold uppercase leading-none"
              style={{
                color: isSelected ? 'rgba(255,255,255,0.8)' : isToday ? '#E8694A' : '#9CA3AF',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {DAYS_SHORT[d.getDay()]}
            </span>
            <span
              className="font-black leading-none mt-1"
              style={{
                fontSize: isToday ? 17 : 14,
                color: isSelected ? 'white' : isToday ? '#E8694A' : '#374151',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {dayNum}
            </span>
            {isToday && (
              <span
                className="text-[7px] font-black mt-0.5 leading-none tracking-wide"
                style={{
                  color: isSelected ? 'rgba(255,255,255,0.9)' : '#E8694A',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                TODAY
              </span>
            )}
            <div className="h-1 flex items-center justify-center mt-0.5">
              {hasTasks && (
                <div
                  className="w-[5px] h-[5px] rounded-full"
                  style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.75)' : '#E8694A' }}
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── 커스텀 체크박스 ──────────────────────────────────────────────
function Checkbox({ checked, onChange }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      className="flex-shrink-0 w-[17px] h-[17px] rounded-[4px] border-2 flex items-center justify-center transition-all active:scale-90"
      style={{ borderColor: checked ? '#10B981' : '#D1D5DB', backgroundColor: checked ? '#10B981' : 'white' }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

// ─── 추가 시트 ───────────────────────────────────────────────────
function AddSheet({ viewDate, onClose, onSubmit }) {
  const [cat,        setCat]        = useState('school')
  const [subj,       setSubj]       = useState('math')
  const [customName, setCustomName] = useState('')
  const [taskText,   setTaskText]   = useState('')
  const [deadline,   setDeadline]   = useState('')
  const [attachFile, setAttachFile] = useState(null)
  const [added,      setAdded]      = useState(false)
  const fileRef = useRef()

  const handleFileChange = e => {
    const f = e.target.files[0]
    if (f) setAttachFile({ name: f.name, file: f })
    e.target.value = ''
  }

  const isToday = viewDate === getTodayISO()

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '94dvh', overflow: 'hidden' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-0.5">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 시트 헤더 */}
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-[13px] font-black text-gray-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            New Task
          </span>
          <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: isToday ? '#FFF3F0' : '#F3F4F6', color: isToday ? '#E8694A' : '#6B7280', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmtViewDate(viewDate)}
          </span>
        </div>

        <div className="overflow-y-auto flex-1">
        <div className="px-5 pt-4 pb-2 flex flex-col gap-4">

          {/* Category */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Category</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: cat === c.id ? c.bg : '#F9FAFB',
                    color: cat === c.id ? c.text : '#9CA3AF',
                    border: `1.5px solid ${cat === c.id ? c.border : '#E5E7EB'}`,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Subject</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {DAILY_SUBJECTS.map(s => (
                <button key={s.id} onClick={() => setSubj(s.id)}
                  className="flex flex-col items-center gap-0.5 py-1 px-0.5 rounded-xl border-2 text-center transition-all active:scale-95"
                  style={{
                    borderColor: subj === s.id ? s.color : '#E5E7EB',
                    backgroundColor: subj === s.id ? s.bg : 'white',
                  }}>
                  <span className="text-[10px] font-black leading-none"
                    style={{ color: subj === s.id ? s.color : '#9CA3AF' }}>
                    {s.abbr}
                  </span>
                  <span className="text-[8px] leading-tight text-center"
                    style={{ color: subj === s.id ? s.color : '#C4B5C0' }}>
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
            {subj === 'custom' && (
              <input
                type="text" value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="과목명 직접 입력..."
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}
              />
            )}
          </div>

          {/* Task */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Task</p>
            <input type="text" value={taskText} onChange={e => setTaskText(e.target.value)}
              placeholder="Enter task description..."
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}
              onFocus={e => e.target.style.borderColor = '#E8694A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Deadline */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Deadline</p>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-700 focus:outline-none transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}
              onFocus={e => e.target.style.borderColor = '#E8694A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Attachment */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Attachment</p>
            {attachFile ? (
              <div className="flex items-center gap-2.5 px-3.5 py-3 bg-orange-50 rounded-xl border border-orange-100">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                <span className="flex-1 text-xs text-gray-600 truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{attachFile.name}</span>
                <button onClick={() => setAttachFile(null)} className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-white text-[9px] active:bg-gray-400">✕</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl border border-dashed border-gray-200 text-gray-400 active:bg-gray-50">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Tap to attach a file</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="*/*" className="hidden" onChange={handleFileChange} />
          </div>


        </div>
        </div>

        {/* ADD 버튼 — 스크롤 영역 밖 고정 */}
        <div className="bg-white border-t border-gray-100 px-5 py-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <button
            onClick={async () => {
              if (!taskText.trim() || added) return
              await onSubmit({ cat, subj, customName, taskText, deadline, attachFile })
              setAdded(true)
              setTimeout(() => {
                setAdded(false)
                setTaskText('')
                setDeadline('')
                setAttachFile(null)
              }, 1800)
            }}
            disabled={!taskText.trim() || added}
            className="w-full py-3.5 rounded-2xl text-white text-[13px] font-black shadow-md active:opacity-80 transition-all duration-300 disabled:opacity-40"
            style={{
              background: added ? '#10B981' : '#E8694A',
              boxShadow: added ? '0 4px 12px rgba(16,185,129,0.3)' : '0 4px 16px rgba(232,105,74,0.35)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {added ? '✓ DONE!' : 'ADD'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── 태스크 수정 시트 ─────────────────────────────────────────────
function EditTaskSheet({ task, onClose }) {
  const [cat,        setCat]        = useState(task.category || 'school')
  const [subj,       setSubj]       = useState(task.subject  || 'math')
  const [customName, setCustomName] = useState(task.subjectName || '')
  const [taskText,   setTaskText]   = useState(task.task     || '')
  const [deadline,   setDeadline]   = useState(task.deadline || '')

  const handleSave = async () => {
    if (!taskText.trim()) return
    const s = getDailySubject(subj)
    await updateDoc(doc(db, 'task-board', task.id), {
      category: cat,
      subject: subj,
      subjectName: subj === 'custom' && customName.trim() ? customName.trim() : s.name,
      task: taskText.trim(),
      deadline,
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: '94dvh', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="flex justify-center pt-3 pb-0.5">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-[13px] font-black text-gray-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Edit Task</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="px-5 pt-4 pb-2 flex flex-col gap-4">
          {/* Category */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Category</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: cat === c.id ? c.bg : '#F9FAFB',
                    color: cat === c.id ? c.text : '#9CA3AF',
                    border: `1.5px solid ${cat === c.id ? c.border : '#E5E7EB'}`,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{c.label}</button>
              ))}
            </div>
          </div>
          {/* Subject */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Subject</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {DAILY_SUBJECTS.map(s => (
                <button key={s.id} onClick={() => setSubj(s.id)}
                  className="flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-xl border-2 text-center transition-all active:scale-95"
                  style={{ borderColor: subj === s.id ? s.color : '#E5E7EB', backgroundColor: subj === s.id ? s.bg : 'white' }}>
                  <span className="text-[10px] font-black leading-none" style={{ color: subj === s.id ? s.color : '#9CA3AF' }}>{s.abbr}</span>
                  <span className="text-[8px] leading-tight text-center" style={{ color: subj === s.id ? s.color : '#C4B5C0' }}>{s.name}</span>
                </button>
              ))}
            </div>
            {subj === 'custom' && (
              <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="과목명 직접 입력..."
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }} />
            )}
          </div>
          {/* Task */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Task</p>
            <input type="text" value={taskText} onChange={e => setTaskText(e.target.value)}
              placeholder="Enter task description..."
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition-colors"
              style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 16 }}
              onFocus={e => e.target.style.borderColor = '#E8694A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
          </div>
          {/* Deadline */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2">Deadline</p>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-700 focus:outline-none transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}
              onFocus={e => e.target.style.borderColor = '#E8694A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold"
              style={{ background: '#F5F3F0', color: '#B8AFA8', fontFamily: 'JetBrains Mono, monospace' }}>CANCEL</button>
            <button onClick={handleSave} disabled={!taskText.trim()}
              className="py-3.5 rounded-2xl text-white text-[13px] font-black shadow-md active:opacity-80 transition-all disabled:opacity-30"
              style={{ flex: 2, backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>SAVE</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 태스크 상세 모달 ─────────────────────────────────────────────
function TaskDetailModal({ task, onDelete, onEdit, onClose }) {
  const [attachImg, setAttachImg] = useState(null)
  const cat  = CAT_MAP[task.category] || CAT_MAP.other
  const subj = getDailySubject(task.subject)

  const handleViewAttachment = async () => {
    if (!task.attachmentId) return
    const blob = await idbGet(task.attachmentId)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    if (blob.type?.startsWith('image/')) {
      setAttachImg(url)
    } else {
      const a = document.createElement('a')
      a.href = url; a.download = task.attachmentName; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
          <span
            className="flex-shrink-0 text-[10px] font-black px-2 py-1 rounded-lg mt-0.5"
            style={{ backgroundColor: subj.bg, color: subj.color, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {task.subjectName || subj.name}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-snug ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}
              style={{ fontFamily: 'Pretendard, sans-serif' }}>
              {task.task}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: cat.bg, color: cat.text, fontFamily: 'JetBrains Mono, monospace' }}>
                {cat.label}
              </span>
              {task.deadline && (
                <span className="text-[10px] text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  D/L {fmtShort(task.deadline)}
                </span>
              )}
              {task.attachmentName && (
                <span className="text-[10px] text-gray-400">📎 {task.attachmentName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {/* Edit 버튼 */}
          <button onClick={() => onEdit(task)}
            className="w-full py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 active:opacity-80"
            style={{ backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Task
          </button>
          {task.attachmentName && (
            <button onClick={handleViewAttachment}
              className="w-full py-3 rounded-2xl bg-gray-50 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 active:bg-gray-100"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              View Attachment
            </button>
          )}
          <button onClick={() => onDelete(task)}
            className="w-full py-3 rounded-2xl font-bold text-sm active:opacity-80"
            style={{ backgroundColor: '#FFF1F2', color: '#BE123C', fontFamily: 'JetBrains Mono, monospace' }}>
            Delete Task
          </button>
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-sm active:bg-gray-200"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            Close
          </button>
        </div>
      </div>
      {attachImg && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => { URL.revokeObjectURL(attachImg); setAttachImg(null) }}>
          <button className="absolute top-5 right-5 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-xl"
            onClick={() => { URL.revokeObjectURL(attachImg); setAttachImg(null) }}>✕</button>
          <img src={attachImg} alt="첨부" className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// ─── Pull-to-Refresh 훅 ───────────────────────────────────────────
function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    let startY = 0, startX = 0, canPull = false
    const onStart = (e) => {
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      canPull = (window.scrollY || document.documentElement.scrollTop) === 0
    }
    const onEnd = (e) => {
      if (!canPull) return
      const dy = e.changedTouches[0].clientY - startY
      const dx = Math.abs(e.changedTouches[0].clientX - startX)
      if (dy > 80 && dx < 40) {
        setRefreshing(true)
        setTimeout(() => setRefreshing(false), 700)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])
  return refreshing
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function TaskManager({ onBack, nickname, addTrigger }) {
  const [tasks, setTasks]               = useState([])
  const [viewDate, setViewDate]         = useState(getTodayISO())
  const [showAdd, setShowAdd]           = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [editingTask,  setEditingTask]  = useState(null)
  const [error, setError]               = useState('')
  // 외부 ADD 트리거
  useEffect(() => { if (addTrigger > 0) setShowAdd(true) }, [addTrigger])
  // Firestore 구독
  useEffect(() => {
    const q = query(collection(db, 'task-board'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => setError(`로드 실패: ${err.code}`))
  }, [])

  // 날짜 이동
  const navigate = useCallback((dir) => {
    setViewDate(prev => addDays(prev, dir))
  }, [])

  // 스와이프 처리 (ref 기반, 렌더링 없이 직접 DOM 조작)
  const tableContainerRef = useRef()
  const drag = useRef({ startX: 0, startY: 0, committed: null, offset: 0 })

  useEffect(() => {
    const el = tableContainerRef.current
    if (!el) return
    const d = drag.current

    const onStart = (e) => {
      d.startX     = e.touches[0].clientX
      d.startY     = e.touches[0].clientY
      d.committed  = null
      d.offset     = 0
      el.style.transition = 'none'
    }

    const onMove = (e) => {
      const dx = e.touches[0].clientX - d.startX
      const dy = e.touches[0].clientY - d.startY
      if (!d.committed) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          d.committed = Math.abs(dx) > Math.abs(dy) * 0.8 ? 'h' : 'v'
        }
        return
      }
      if (d.committed !== 'h') return
      e.preventDefault()
      d.offset = dx * 0.82
      el.style.transform = `translateX(${d.offset}px)`
    }

    const onEnd = () => {
      if (d.committed !== 'h') { d.committed = null; return }
      const ox = d.offset
      d.committed = null
      d.offset    = 0

      if (Math.abs(ox) > 42) {
        const dir    = ox < 0 ? 1 : -1
        const exitX  = ox < 0 ? -window.innerWidth : window.innerWidth
        el.style.transition = 'transform 0.18s ease-in'
        el.style.transform  = `translateX(${exitX}px)`
        setTimeout(() => {
          navigate(dir)
          el.style.transition = 'none'
          el.style.transform  = `translateX(${-exitX}px)`
          void el.getBoundingClientRect() // force reflow
          el.style.transition = 'transform 0.22s ease-out'
          el.style.transform  = 'translateX(0)'
        }, 185)
      } else {
        el.style.transition = 'transform 0.28s ease-out'
        el.style.transform  = 'translateX(0)'
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    el.addEventListener('touchcancel',onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
      el.removeEventListener('touchcancel',onEnd)
    }
  }, [navigate])

  // CRUD
  const toggleDone = async task => {
    await updateDoc(doc(db, 'task-board', task.id), { done: !task.done })
  }
  const deleteTask = async task => {
    await deleteDoc(doc(db, 'task-board', task.id))
    setSelectedTask(null)
  }
  const handleSubmit = async ({ cat, subj, customName, taskText, deadline, attachFile }) => {
    if (!taskText.trim()) return
    let attachmentId = null, attachmentName = ''
    if (attachFile) {
      attachmentId   = await idbSave(attachFile.file)
      attachmentName = attachFile.name
    }
    const s = getDailySubject(subj)
    await addDoc(collection(db, 'task-board'), {
      category: cat, subject: subj,
      subjectName: subj === 'custom' && customName.trim() ? customName.trim() : s.name,
      task: taskText.trim(), deadline,
      attachmentName, attachmentId: attachmentId || null,
      done: false, author: nickname || '익명',
      taskDate: viewDate,
      createdAt: serverTimestamp(),
    })
  }

  // 날짜별 필터
  const today  = getTodayISO()
  const visibleTasks = tasks.filter(t => getTaskDate(t) === viewDate)
  const byCategory   = CATEGORIES.reduce((acc, c) => {
    acc[c.id] = visibleTasks.filter(t => t.category === c.id)
    return acc
  }, {})

  // 미완료 이전 날짜 과제 (오늘 기준)
  const overdueTasks = tasks.filter(t => getTaskDate(t) < today && !t.done)
  const overdueGroups = overdueTasks.reduce((acc, t) => {
    const d = getTaskDate(t)
    if (!acc[d]) acc[d] = []
    acc[d].push(t)
    return acc
  }, {})
  const sortedOverdueDates = Object.keys(overdueGroups).sort((a, b) => b.localeCompare(a))

  // 그리드 컬럼 (Subj 72 | Task 1fr | D/L 44 | Attc 36)
  const gridCols = '72px 1fr 44px 36px'
  const isToday  = viewDate === today

  return (
    <PullToRefreshWrapper onRefresh={() => setViewDate(getTodayISO())} bg="#F8F7F5">
    <div className="min-h-screen bg-stone-50 flex flex-col" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center justify-center rounded-xl p-2.5 active:opacity-70"
            style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" stroke="#E8694A" strokeWidth="2"/>
            </svg>
          </button>
          <span className="text-sm font-black" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
            TASK BOARD
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <span className="text-red-500 shrink-0">⚠️</span>
          <span className="text-red-700 text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400">✕</button>
        </div>
      )}

      {/* ── 날짜 탭 스트립 ───────────────────────────────────────── */}
      <DateTabStrip viewDate={viewDate} tasks={tasks} onSelect={setViewDate} />

      {/* ── 테이블 (스와이프 컨테이너) ─────────────────────────────── */}
      <div className="overflow-hidden px-4 pb-5 flex-1">
        <div ref={tableContainerRef} className="w-full will-change-transform">
          <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}>

            {/* 테이블 헤더 */}
            <div className="border-b border-gray-200/40" style={{ backgroundColor: 'rgba(232,105,74,0.07)' }}>
              <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-2 py-2.5 text-[10px] font-bold text-[#C4845A] border-r border-gray-200/40" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Subj.</div>
                <div className="px-2 py-2.5 text-[10px] font-bold text-[#C4845A]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>The task</div>
                <div className="px-1 py-2.5 text-[10px] font-bold text-[#C4845A] border-l border-gray-200/40 text-center" style={{ fontFamily: 'JetBrains Mono, monospace' }}>D/L</div>
                <div className="px-1 py-2.5 text-[10px] font-bold text-[#C4845A] border-l border-gray-200/40 text-center" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Attc.</div>
              </div>
            </div>

            {/* 카테고리 섹션 */}
            {CATEGORIES.map(cat => {
              const catTasks = byCategory[cat.id] || []
              const doneCount = catTasks.filter(t => t.done).length
              return (
                <div key={cat.id}>
                  {/* 카테고리 구분 행 */}
                  <div className="border-b" style={{ backgroundColor: cat.bg, borderColor: cat.border }}>
                    <div className="px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[11px] font-black" style={{ color: cat.text, fontFamily: 'JetBrains Mono, monospace' }}>
                        {cat.label}
                      </span>
                      {catTasks.length > 0 && (
                        <span className="text-[9px] font-bold opacity-50" style={{ color: cat.text }}>
                          {doneCount}/{catTasks.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 빈 줄 */}
                  {catTasks.length === 0 && (
                    <>
                      {[0, 1].map(i => (
                        <div key={i} className="grid border-b border-gray-200/40" style={{ gridTemplateColumns: gridCols, minHeight: 34 }}>
                          <div className="border-r border-gray-200/40" /><div /><div className="border-l border-gray-200/40" /><div className="border-l border-gray-200/40" />
                        </div>
                      ))}
                    </>
                  )}

                  {/* 태스크 행 */}
                  {catTasks.map(task => {
                    const s = getDailySubject(task.subject)
                    return (
                      <div key={task.id}
                        className="grid border-b border-gray-200/40 last:border-0 cursor-pointer active:bg-orange-50/60 transition-colors"
                        style={{ gridTemplateColumns: gridCols, minHeight: 38 }}
                        onClick={() => setSelectedTask(task)}>

                        {/* Subj. — 한글 과목명 */}
                        <div className="px-1.5 py-2 border-r border-gray-200/40 flex items-center justify-center">
                          <span
                            className="text-[9px] font-black text-center leading-tight px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: s.bg,
                              color: task.done ? '#CBD5E1' : s.color,
                              fontFamily: 'JetBrains Mono, monospace',
                              maxWidth: '64px',
                              display: 'block',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                            }}>
                            {task.subjectName || s.name}
                          </span>
                        </div>

                        {/* Task */}
                        <div className="px-2 py-2 flex items-center gap-2 min-w-0">
                          <Checkbox checked={!!task.done} onChange={() => toggleDone(task)} />
                          <span className="text-[13px] leading-snug min-w-0"
                            style={{
                              color: task.done ? '#CBD5E1' : '#1F2937',
                              textDecoration: task.done ? 'line-through' : 'none',
                              fontFamily: 'Pretendard, sans-serif',
                              fontWeight: 500,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}>
                            {task.task}
                          </span>
                        </div>

                        {/* D/L */}
                        <div className="px-1 py-2 border-l border-gray-200/40 flex items-center justify-center">
                          <span className="text-[10px] font-semibold"
                            style={{ color: task.done ? '#CBD5E1' : '#6B7280', fontFamily: 'JetBrains Mono, monospace' }}>
                            {fmtShort(task.deadline) || '—'}
                          </span>
                        </div>

                        {/* Attc. */}
                        <div className="px-1 py-2 border-l border-gray-200/40 flex items-center justify-center">
                          {task.attachmentName && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                              stroke={task.done ? '#CBD5E1' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* 전체 완료율 */}
          {visibleTasks.length > 0 && (
            <div className="flex items-center justify-end gap-2 mt-2 px-1">
              <div className="flex-1 max-w-[100px] h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${(visibleTasks.filter(t=>t.done).length / visibleTasks.length) * 100}%`, backgroundColor: '#10B981' }} />
              </div>
              <span className="text-[9px] text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {visibleTasks.filter(t=>t.done).length}/{visibleTasks.length} completed
              </span>
            </div>
          )}
        </div>

        {/* ── Overdue 경고 섹션 ─────────────────────────────────────── */}
        {sortedOverdueDates.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#BE123C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span className="text-[10px] font-black" style={{ color: '#BE123C', fontFamily: 'JetBrains Mono, monospace' }}>
                  OVERDUE  ·  {overdueTasks.length}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {sortedOverdueDates.map(date => (
                <div key={date} className="bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#FECDD3' }}>
                  {/* 날짜 헤더 */}
                  <div className="px-3 py-1.5 flex items-center gap-2" style={{ backgroundColor: '#FFF1F2' }}>
                    <span className="text-[10px] font-black" style={{ color: '#BE123C', fontFamily: 'JetBrains Mono, monospace' }}>
                      {fmtShort(date)}
                    </span>
                    <span className="text-[9px] text-rose-300 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {overdueGroups[date].length} incomplete
                    </span>
                  </div>
                  {/* 해당 날짜 미완료 태스크들 */}
                  {overdueGroups[date].map((task, idx) => {
                    const s = getDailySubject(task.subject)
                    const cat = CAT_MAP[task.category] || CAT_MAP.other
                    return (
                      <div key={task.id}
                        className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer active:bg-rose-50 transition-colors ${idx > 0 ? 'border-t border-rose-50' : ''}`}
                        onClick={() => setSelectedTask(task)}>
                        <Checkbox checked={false} onChange={() => toggleDone(task)} />
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ backgroundColor: s.bg, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                          {task.subjectName || s.name}
                        </span>
                        <span className="flex-1 text-[11px] text-gray-600 leading-snug" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {task.task}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.bg, color: cat.text, fontFamily: 'JetBrains Mono, monospace' }}>
                          {cat.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 모달 / 시트 ─────────────────────────────────────────── */}
      {showAdd && (
        <AddSheet viewDate={viewDate} onClose={() => setShowAdd(false)} onSubmit={handleSubmit} />
      )}
      {selectedTask && !editingTask && (
        <TaskDetailModal
          task={selectedTask}
          onDelete={deleteTask}
          onEdit={t => { setEditingTask(t); setSelectedTask(null) }}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {editingTask && (
        <EditTaskSheet task={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
    </PullToRefreshWrapper>
  )
}
