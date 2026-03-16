import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, query, onSnapshot, orderBy,
  serverTimestamp, doc, deleteDoc, updateDoc,
} from 'firebase/firestore'
import { SUBJECTS, getSubject } from './subjectConfig'

// ─── Task 카테고리 ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'school',     label: 'School',     bg: '#FFE4E6', border: '#FECDD3', text: '#BE123C' },
  { id: 'tutoring',   label: 'Tutoring',   bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },
  { id: 'coursework', label: 'Coursework', bg: '#EDE9FE', border: '#DDD6FE', text: '#6D28D9' },
  { id: 'other',      label: 'Other',      bg: '#F3F4F6', border: '#E5E7EB', text: '#4B5563' },
]
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

// ─── IndexedDB (첨부파일) ─────────────────────────────────────────
const IDB_NAME = 'studybuddy-task-files'
const IDB_VER  = 1
const IDB_STORE = 'files'

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER)
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

// ─── 유틸 ────────────────────────────────────────────────────────
function fmtDeadline(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
function todayLabel() {
  const n = new Date()
  return `${n.getMonth() + 1}/${n.getDate()}`
}

// ─── 커스텀 체크박스 ──────────────────────────────────────────────
function Checkbox({ checked, onChange }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      className="flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all active:scale-90"
      style={{
        borderColor: checked ? '#10B981' : '#D1D5DB',
        backgroundColor: checked ? '#10B981' : 'transparent',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

// ─── 추가 시트 ───────────────────────────────────────────────────
function AddSheet({ onClose, onSubmit, nickname }) {
  const [cat,        setCat]        = useState('school')
  const [subj,       setSubj]       = useState('math')
  const [taskText,   setTaskText]   = useState('')
  const [deadline,   setDeadline]   = useState('')
  const [attachFile, setAttachFile] = useState(null)
  const fileRef = useRef()

  const handleFileChange = e => {
    const f = e.target.files[0]
    if (f) setAttachFile({ name: f.name, file: f })
    e.target.value = ''
  }

  const handleSubmit = () => onSubmit({ cat, subj, taskText, deadline, attachFile })

  return (
    <>
      {/* 배경 */}
      <div className="fixed inset-0 z-40 bg-black/30" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />

      {/* 시트 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 시트 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-[13px] font-black text-gray-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            New Task
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-5 pt-5 pb-6 flex flex-col gap-5">

          {/* Category */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2.5">Category</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className="px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: cat === c.id ? c.bg : '#F9FAFB',
                    color: cat === c.id ? c.text : '#9CA3AF',
                    border: `1.5px solid ${cat === c.id ? c.border : '#E5E7EB'}`,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2.5">Subject</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SUBJECTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSubj(s.id)}
                  className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border-2 text-center transition-all active:scale-95"
                  style={{
                    borderColor: subj === s.id ? '#E8694A' : '#E5E7EB',
                    backgroundColor: subj === s.id ? '#FFF3F0' : 'white',
                  }}
                >
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span
                    className="text-[9px] font-bold leading-none"
                    style={{ color: subj === s.id ? '#E8694A' : '#9CA3AF' }}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Task */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2.5">Task</p>
            <input
              type="text"
              value={taskText}
              onChange={e => setTaskText(e.target.value)}
              placeholder="Enter task description..."
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              onFocus={e => e.target.style.borderColor = '#E8694A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Deadline */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2.5">Deadline</p>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-700 focus:outline-none transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              onFocus={e => e.target.style.borderColor = '#E8694A'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Attachment */}
          <div>
            <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-2.5">Attachment</p>
            {attachFile ? (
              <div className="flex items-center gap-2.5 px-3.5 py-3 bg-orange-50 rounded-xl border border-orange-100">
                <span className="text-base">📎</span>
                <span className="flex-1 text-xs text-gray-600 truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {attachFile.name}
                </span>
                <button
                  onClick={() => setAttachFile(null)}
                  className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-white active:bg-gray-400"
                  style={{ fontSize: 9 }}
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl border border-dashed border-gray-200 text-gray-400 active:bg-gray-50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                <span className="text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Tap to attach a file</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="*/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!taskText.trim()}
            className="w-full py-3.5 rounded-2xl text-white text-[13px] font-black shadow-md active:opacity-80 transition-all disabled:opacity-30"
            style={{ backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Add Task
          </button>
        </div>
      </div>
    </>
  )
}

// ─── 태스크 상세/삭제 모달 ─────────────────────────────────────────
function TaskDetailModal({ task, onDelete, onClose }) {
  const [attachImg, setAttachImg] = useState(null)
  const cat = CAT_MAP[task.category] || CAT_MAP.other

  const handleViewAttachment = async () => {
    if (!task.attachmentId) return
    const blob = await idbGet(task.attachmentId)
    if (blob) {
      const url = URL.createObjectURL(blob)
      // 이미지면 미리보기, 아니면 새 탭에서 열기
      if (blob.type?.startsWith('image/')) {
        setAttachImg(url)
      } else {
        const a = document.createElement('a')
        a.href = url; a.download = task.attachmentName; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl p-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 태스크 정보 */}
        <div className="flex items-start gap-3 mb-5 pb-5 border-b border-gray-100">
          <span className="text-2xl leading-none mt-0.5">{getSubject(task.subject).emoji}</span>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold leading-snug ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {task.task}
            </p>
            <p className="text-[10px] text-gray-400 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {getSubject(task.subject).label}
              {task.deadline ? ` · D/L ${fmtDeadline(task.deadline)}` : ''}
              {task.attachmentName ? ` · 📎 ${task.attachmentName}` : ''}
            </p>
          </div>
          <span
            className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full"
            style={{ backgroundColor: cat.bg, color: cat.text, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {cat.label}
          </span>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex flex-col gap-2">
          {task.attachmentName && (
            <button
              onClick={handleViewAttachment}
              className="w-full py-3 rounded-2xl bg-gray-50 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 active:bg-gray-100"
            >
              <span>📎</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>View Attachment</span>
            </button>
          )}
          <button
            onClick={() => onDelete(task)}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:opacity-80"
            style={{ backgroundColor: '#FFF1F2', color: '#BE123C', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Delete Task
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold text-sm active:bg-gray-200"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* 첨부 이미지 전체보기 */}
      {attachImg && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => { URL.revokeObjectURL(attachImg); setAttachImg(null) }}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-xl"
            onClick={() => { URL.revokeObjectURL(attachImg); setAttachImg(null) }}
          >✕</button>
          <img src={attachImg} alt="첨부파일" className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function TaskManager({ onBack, nickname }) {
  const [tasks, setTasks]             = useState([])
  const [showAdd, setShowAdd]         = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [error, setError]             = useState('')

  // Firestore 구독
  useEffect(() => {
    const q = query(collection(db, 'task-board'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => setError(`로드 실패: ${err.code}`))
  }, [])

  // 완료 토글
  const toggleDone = async task => {
    await updateDoc(doc(db, 'task-board', task.id), { done: !task.done })
  }

  // 삭제
  const deleteTask = async task => {
    await deleteDoc(doc(db, 'task-board', task.id))
    setSelectedTask(null)
  }

  // 추가
  const handleSubmit = async ({ cat, subj, taskText, deadline, attachFile }) => {
    if (!taskText.trim()) return
    let attachmentId = null, attachmentName = ''
    if (attachFile) {
      attachmentId = await idbSave(attachFile.file)
      attachmentName = attachFile.name
    }
    await addDoc(collection(db, 'task-board'), {
      category: cat,
      subject: subj,
      task: taskText.trim(),
      deadline,
      attachmentName,
      attachmentId: attachmentId || null,
      done: false,
      author: nickname || '익명',
      createdAt: serverTimestamp(),
    })
    setShowAdd(false)
  }

  // 카테고리별 분류
  const byCategory = CATEGORIES.reduce((acc, c) => {
    acc[c.id] = tasks.filter(t => t.category === c.id)
    return acc
  }, {})

  // 컬럼 비율: Subj(56) | Task(1fr) | D/L(44) | Attc(36)
  const gridCols = '56px 1fr 44px 36px'

  return (
    <div
      className="min-h-screen bg-stone-50 flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center justify-center rounded-xl p-2.5 transition active:opacity-70"
              style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" stroke="#E8694A" strokeWidth="2"/>
              </svg>
            </button>
            <span className="text-sm font-black" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
              TASK BOARD
            </span>
          </div>

          {/* +ADD */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-[11px] font-black shadow-sm active:opacity-75 transition-opacity"
            style={{ backgroundColor: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            +ADD
          </button>
        </div>
      </div>

      {/* 오류 */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <span className="text-red-500 shrink-0">⚠️</span>
          <span className="text-red-700 text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400">✕</button>
        </div>
      )}

      {/* ── 테이블 ───────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-8 flex-1">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">

          {/* 테이블 헤더 */}
          <div className="bg-gray-900 text-white">
            {/* 날짜 탭 */}
            <div className="flex items-end px-3 pt-2.5 gap-0">
              <div
                className="px-3 py-1 rounded-t-lg text-[11px] font-black"
                style={{
                  backgroundColor: '#E8694A',
                  color: 'white',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.05em',
                }}
              >
                {todayLabel()}
              </div>
            </div>
            {/* 컬럼 라벨 */}
            <div className="grid border-t border-gray-700" style={{ gridTemplateColumns: gridCols }}>
              <div className="px-2 py-2 text-[10px] font-bold text-gray-400 border-r border-gray-700"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                Subj.
              </div>
              <div className="px-2 py-2 text-[10px] font-bold text-gray-300"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                The task
              </div>
              <div className="px-1 py-2 text-[10px] font-bold text-gray-400 border-l border-gray-700 text-center"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                D/L
              </div>
              <div className="px-1 py-2 text-[10px] font-bold text-gray-400 border-l border-gray-700 text-center"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                Attc.
              </div>
            </div>
          </div>

          {/* 카테고리 섹션들 */}
          {CATEGORIES.map(cat => {
            const catTasks = byCategory[cat.id] || []
            return (
              <div key={cat.id}>
                {/* 카테고리 구분 행 */}
                <div
                  className="grid items-center border-b"
                  style={{
                    gridTemplateColumns: gridCols,
                    backgroundColor: cat.bg,
                    borderColor: cat.border,
                  }}
                >
                  <div
                    className="col-span-4 px-3 py-1.5 text-[11px] font-black"
                    style={{ color: cat.text, fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {cat.label}
                    <span className="ml-1.5 text-[9px] font-bold opacity-50">
                      {catTasks.length > 0 ? `${catTasks.filter(t=>t.done).length}/${catTasks.length}` : '—'}
                    </span>
                  </div>
                </div>

                {/* 태스크 없을 때 빈 줄 표시 */}
                {catTasks.length === 0 && (
                  <>
                    {[0, 1].map(i => (
                      <div
                        key={i}
                        className="grid border-b border-gray-50"
                        style={{ gridTemplateColumns: gridCols, minHeight: 36 }}
                      >
                        <div className="border-r border-gray-50" />
                        <div />
                        <div className="border-l border-gray-50" />
                        <div className="border-l border-gray-50" />
                      </div>
                    ))}
                  </>
                )}

                {/* 태스크 행들 */}
                {catTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="grid border-b border-gray-50 last:border-0 cursor-pointer transition-colors active:bg-gray-50"
                    style={{ gridTemplateColumns: gridCols, minHeight: 40 }}
                    onClick={() => setSelectedTask(task)}
                  >
                    {/* Subj. */}
                    <div className="px-1.5 py-2 border-r border-gray-100 flex items-center gap-1.5 min-w-0">
                      <span className="text-[15px] leading-none flex-shrink-0">
                        {getSubject(task.subject).emoji}
                      </span>
                      <span
                        className="text-[9px] font-semibold truncate hidden xs:block"
                        style={{ color: task.done ? '#D1D5DB' : '#6B7280' }}
                      >
                        {getSubject(task.subject).label}
                      </span>
                    </div>

                    {/* Task */}
                    <div className="px-2 py-2 flex items-center gap-2 min-w-0">
                      <Checkbox checked={!!task.done} onChange={() => toggleDone(task)} />
                      <span
                        className="text-[11px] leading-snug truncate"
                        style={{
                          color: task.done ? '#D1D5DB' : '#1F2937',
                          textDecoration: task.done ? 'line-through' : 'none',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {task.task}
                      </span>
                    </div>

                    {/* D/L */}
                    <div className="px-1 py-2 border-l border-gray-100 flex items-center justify-center">
                      <span
                        className="text-[10px] font-semibold"
                        style={{
                          color: task.done ? '#D1D5DB' : '#6B7280',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {fmtDeadline(task.deadline) || '—'}
                      </span>
                    </div>

                    {/* Attc. */}
                    <div className="px-1 py-2 border-l border-gray-100 flex items-center justify-center">
                      {task.attachmentName && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke={task.done ? '#D1D5DB' : '#9CA3AF'}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* 총 완료 현황 */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-end gap-2 mt-3 px-1">
            <span className="text-[10px] text-gray-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {tasks.filter(t => t.done).length} / {tasks.length} completed
            </span>
            <div className="flex-1 max-w-[120px] h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(tasks.filter(t=>t.done).length / tasks.length) * 100}%`,
                  backgroundColor: '#10B981',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 추가 시트 ───────────────────────────────────────────── */}
      {showAdd && (
        <AddSheet
          onClose={() => setShowAdd(false)}
          onSubmit={handleSubmit}
          nickname={nickname}
        />
      )}

      {/* ── 태스크 상세 모달 ─────────────────────────────────────── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onDelete={deleteTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
