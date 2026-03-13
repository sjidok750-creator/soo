import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import {
  collection, onSnapshot, query, orderBy, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, writeBatch, getDocs
} from 'firebase/firestore'
import { useToast } from './Toast'
import {
  getSubject, STUDY_TYPES, getStudyType, DIFFICULTIES, getDifficulty, getAvatarColor
} from './subjectConfig'

const NICKNAME_KEY = 'study-buddy-nickname'

function getTodayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

// 마감일 포맷
function formatDueDate(dateStr) {
  if (!dateStr) return null
  const today = new Date(new Date().toDateString())
  const due = new Date(dateStr + 'T00:00:00')
  const diff = Math.ceil((due - today) / 86400000)
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'bg-gray-100 text-gray-500' }
  if (diff === 0) return { label: 'D-Day', cls: 'bg-red-100 text-red-600 font-bold' }
  if (diff <= 3) return { label: `D-${diff}`, cls: 'bg-orange-100 text-orange-600 font-bold' }
  return { label: `D-${diff}`, cls: 'bg-teal-100 text-teal-600' }
}

// 시간 포맷
function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// 아바타 컴포넌트
function Avatar({ name, size = 'sm' }) {
  const bg = getAvatarColor(name)
  const sz = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
  return (
    <span className={`${sz} rounded-full ${bg} text-white font-bold flex items-center justify-center shrink-0`}>
      {name[0]}
    </span>
  )
}

export default function SubjectDetail({ subject, onBack }) {
  const nickname = localStorage.getItem(NICKNAME_KEY) ?? '익명'
  const [todos, setTodos] = useState([])
  const [filter, setFilter] = useState('all') // all | active | done
  const [text, setText] = useState('')
  const [studyType, setStudyType] = useState('homework')
  const [difficulty, setDifficulty] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editStudyType, setEditStudyType] = useState('homework')
  const [editDifficulty, setEditDifficulty] = useState('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { addToast, ToastContainer } = useToast()
  const prevIdsRef = useRef(null)

  // 드래그 상태
  const dragItem = useRef(null)
  const dragOver = useRef(null)
  const [dragging, setDragging] = useState(false)

  // 터치 드래그 상태
  const touchItem = useRef(null)
  const touchStartY = useRef(0)
  const [touchDragIdx, setTouchDragIdx] = useState(null)

  // Pull-to-refresh
  const pullStartY = useRef(0)
  const [refreshing, setRefreshing] = useState(false)

  const colRef = collection(db, 'study-todos')

  useEffect(() => {
    return onSnapshot(colRef, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const filtered = all
        .filter(t => t.subject === subject.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))

      // 새 항목 토스트 알림
      if (prevIdsRef.current !== null) {
        filtered.forEach(t => {
          if (!prevIdsRef.current.has(t.id) && t.author !== nickname) {
            addToast(`${t.author}님이 추가: "${t.text}"`, { icon: subject.emoji, duration: 5000 })
          }
        })
      }
      prevIdsRef.current = new Set(filtered.map(t => t.id))
      setTodos(filtered)
    }, (err) => {
      console.error('Todos read error:', err)
      addToast(`❌ 데이터 로드 실패: ${err.code}`)
    })
  }, [subject.id])

  async function handleAdd(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const maxOrder = todos.length > 0 ? Math.max(...todos.map(t => t.order ?? 0)) + 1 : 0
      await addDoc(colRef, {
        text: trimmed,
        done: false,
        author: nickname,
        subject: subject.id,
        studyType,
        difficulty,
        dueDate: dueDate || null,
        order: maxOrder,
        date: getTodayStr(),
        createdAt: serverTimestamp(),
      })
      setText('')
      setDueDate('')
      setShowForm(false)
      addToast('할 일이 추가됐어요!', { icon: '✅' })
    } catch (err) {
      console.error('Todo add error:', err)
      addToast(`❌ 저장 실패: ${err.code ?? err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleDone(todo) {
    await updateDoc(doc(db, 'study-todos', todo.id), { done: !todo.done })
    if (!todo.done) addToast('완료했어요! 대단해요 🎉', { icon: '🌟' })
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editText.trim()) return
    await updateDoc(doc(db, 'study-todos', editingId), {
      text: editText.trim(),
      studyType: editStudyType,
      difficulty: editDifficulty,
      dueDate: editDueDate || null,
    })
    setEditingId(null)
    addToast('수정됐어요', { icon: '✏️' })
  }

  function startEdit(todo) {
    setEditingId(todo.id)
    setEditText(todo.text)
    setEditStudyType(todo.studyType || 'homework')
    setEditDifficulty(todo.difficulty || 'medium')
    setEditDueDate(todo.dueDate || '')
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db, 'study-todos', id))
    setDeleteConfirm(null)
    addToast('삭제됐어요', { icon: '🗑️' })
  }

  // 드래그앤드롭 순서 저장
  async function saveOrder(newTodos) {
    const batch = writeBatch(db)
    newTodos.forEach((t, i) => {
      batch.update(doc(db, 'study-todos', t.id), { order: i })
    })
    await batch.commit()
  }

  // 마우스 드래그
  function onDragStart(i) { dragItem.current = i; setDragging(true) }
  function onDragEnter(i) { dragOver.current = i }
  function onDragEnd() {
    setDragging(false)
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return
    const reordered = [...displayTodos]
    const [removed] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOver.current, 0, removed)
    dragItem.current = null
    dragOver.current = null
    // 전체 todos에서 이 과목 항목 순서 업데이트
    saveOrder(reordered)
  }

  // 터치 드래그
  function onTouchStart(e, i) {
    touchItem.current = i
    touchStartY.current = e.touches[0].clientY
    setTouchDragIdx(i)
  }
  function onTouchMove(e) {
    if (touchItem.current === null) return
    e.preventDefault()
    const y = e.touches[0].clientY
    const els = document.querySelectorAll('[data-todo-item]')
    let overIdx = touchItem.current
    els.forEach((el, idx) => {
      const rect = el.getBoundingClientRect()
      if (y >= rect.top && y <= rect.bottom) overIdx = idx
    })
    dragOver.current = overIdx
  }
  function onTouchEnd() {
    if (touchItem.current !== null && dragOver.current !== null && touchItem.current !== dragOver.current) {
      const reordered = [...displayTodos]
      const [removed] = reordered.splice(touchItem.current, 1)
      reordered.splice(dragOver.current, 0, removed)
      saveOrder(reordered)
    }
    touchItem.current = null
    dragOver.current = null
    setTouchDragIdx(null)
  }

  // 필터
  const displayTodos = todos.filter(t => {
    if (filter === 'active') return !t.done
    if (filter === 'done') return t.done
    return true
  })

  const totalCount = todos.length
  const doneCount = todos.filter(t => t.done).length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const subj = getSubject(subject.id)

  return (
    <div className={`min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 ${dragging ? 'dragging-active' : ''}`}>
      {/* 스티키 헤더 */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
              ←
            </button>
            <span className="text-xl">{subj.emoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className={`font-bold ${subj.textClass} truncate`}>{subj.label}</h1>
              <p className="text-xs text-gray-400">{doneCount}/{totalCount} 완료</p>
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold ${progress === 100 ? 'text-emerald-500' : subj.textClass}`}>{progress}%</span>
            </div>
          </div>
          {/* 진도바 */}
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                progress === 100 ? 'bg-emerald-500' :
                subject.id === 'math' ? 'bg-blue-400' :
                subject.id === 'english' ? 'bg-emerald-400' :
                subject.id === 'korean' ? 'bg-red-400' :
                subject.id === 'science' ? 'bg-purple-400' :
                subject.id === 'social' ? 'bg-amber-400' :
                subject.id === 'history' ? 'bg-orange-400' : 'bg-gray-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* 필터 탭 */}
        <div className="flex bg-white rounded-xl shadow-sm p-1 gap-1">
          {[
            { key: 'all', label: `전체 ${totalCount}` },
            { key: 'active', label: `미완료 ${totalCount - doneCount}` },
            { key: 'done', label: `완료 ${doneCount}` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition ${filter === f.key ? `${subj.bgClass} ${subj.textClass} border ${subj.borderClass}` : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 할 일 목록 */}
        {displayTodos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">{filter === 'done' ? '🎉' : '📝'}</p>
            <p className="text-sm">{filter === 'done' ? '아직 완료한 항목이 없어요' : '할 일을 추가해보세요!'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTodos.map((todo, i) => {
              const st = getStudyType(todo.studyType)
              const diff = getDifficulty(todo.difficulty)
              const due = formatDueDate(todo.dueDate)
              const isEditing = editingId === todo.id

              return (
                <div
                  key={todo.id}
                  data-todo-item
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragEnter={() => onDragEnter(i)}
                  onDragEnd={onDragEnd}
                  onDragOver={e => e.preventDefault()}
                  onTouchStart={e => onTouchStart(e, i)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  className={`bg-white rounded-2xl shadow-sm border transition-all ${todo.done ? 'opacity-60 border-gray-100' : `border-gray-100 hover:border-${subj.color}-200`} ${touchDragIdx === i ? 'scale-95 shadow-lg opacity-80' : ''}`}
                >
                  {isEditing ? (
                    /* 수정 폼 */
                    <form onSubmit={handleEdit} className="p-3 space-y-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        autoFocus
                        maxLength={200}
                      />
                      <div className="flex gap-2 flex-wrap">
                        <select
                          value={editStudyType}
                          onChange={e => setEditStudyType(e.target.value)}
                          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          {STUDY_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                        </select>
                        <select
                          value={editDifficulty}
                          onChange={e => setEditDifficulty(e.target.value)}
                          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          {DIFFICULTIES.map(d => <option key={d.id} value={d.id}>{d.stars} {d.label}</option>)}
                        </select>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={e => setEditDueDate(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-teal-500 text-white text-sm py-1.5 rounded-lg font-medium">저장</button>
                        <button type="button" onClick={() => setEditingId(null)} className="px-3 bg-gray-200 text-gray-600 text-sm py-1.5 rounded-lg">취소</button>
                      </div>
                    </form>
                  ) : (
                    /* 표시 */
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        {/* 체크박스 */}
                        <button
                          onClick={() => toggleDone(todo)}
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${todo.done ? 'bg-emerald-500 border-emerald-500 text-white' : `border-gray-300 hover:border-${subj.color}-400`}`}
                        >
                          {todo.done && <span className="text-xs">✓</span>}
                        </button>

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${todo.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {todo.text}
                          </p>

                          {/* 배지들 */}
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {/* 학습 유형 */}
                            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${st.badgeClass} font-medium`}>
                              {st.emoji} {st.label}
                            </span>
                            {/* 난이도 */}
                            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${diff.badgeClass}`}>
                              {diff.stars}
                            </span>
                            {/* 마감일 */}
                            {due && !todo.done && (
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${due.cls}`}>
                                📅 {due.label}
                              </span>
                            )}
                          </div>

                          {/* 작성자 & 시간 */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Avatar name={todo.author} />
                            <span className="text-[11px] text-gray-400">
                              {todo.author} · {formatTime(todo.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(todo)}
                            className="text-gray-300 hover:text-teal-500 text-sm p-1 transition"
                            title="수정"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(todo.id)}
                            className="text-gray-300 hover:text-red-400 text-sm p-1 transition"
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 할 일 추가 */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className={`w-full py-3 border-2 border-dashed ${subj.borderClass} ${subj.textClass} rounded-2xl text-sm hover:${subj.bgClass} transition font-medium`}
          >
            + 할 일 추가
          </button>
        ) : (
          <form onSubmit={handleAdd} className={`${subj.bgClass} border ${subj.borderClass} rounded-2xl p-4 space-y-3`}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`${subj.label} 할 일을 입력하세요... (최대 200자)`}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[60px]"
              maxLength={200}
              autoFocus
            />

            {/* 학습 유형 선택 */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">학습 유형</p>
              <div className="flex flex-wrap gap-1.5">
                {STUDY_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStudyType(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs border font-medium transition active:scale-95 ${studyType === t.id ? t.badgeClass + ' scale-105' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 난이도 선택 */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">난이도</p>
              <div className="flex gap-1.5">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={`flex-1 py-1 rounded-lg text-xs border font-medium transition active:scale-95 ${difficulty === d.id ? d.badgeClass + ' scale-105' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    {d.stars} {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 마감일 */}
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">마감일 (선택)</p>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className={`flex-1 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-semibold transition active:scale-95`}
              >
                {submitting ? '추가 중...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setText(''); setDueDate('') }}
                className="px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl text-sm transition"
              >
                취소
              </button>
            </div>
          </form>
        )}

        <div className="pb-8" />
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-gray-800 mb-1">할 일 삭제</p>
            <p className="text-sm text-gray-500 mb-4">이 항목을 삭제할까요?</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl font-medium transition">삭제</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-xl transition">취소</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  )
}
