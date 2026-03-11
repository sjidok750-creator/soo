import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from './firebase'
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp,
  deleteDoc, doc
} from 'firebase/firestore'
import { useToast } from './Toast'
import { SUBJECTS, getSubject, getAvatarColor } from './subjectConfig'

const NICKNAME_KEY = 'study-buddy-nickname'

// 한국 공휴일 (고정)
const FIXED_HOLIDAYS = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
  '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
  '10-09': '한글날', '12-25': '성탄절',
}

// 시험 일정 색상
const EXAM_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-purple-400', 'bg-blue-400', 'bg-teal-400']

function CalendarModal({ onClose, nickname }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [exams, setExams] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newExam, setNewExam] = useState({ title: '', date: '', subject: 'math' })
  const { addToast, ToastContainer } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'exam-schedule'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const weeks = []
  let day = 1
  let nextDay = 1
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  for (let i = 0; i < totalCells; i++) {
    if (i < firstDay) {
      weeks.push({ day: prevMonthDays - firstDay + i + 1, type: 'prev' })
    } else if (day <= daysInMonth) {
      weeks.push({ day: day++, type: 'current' })
    } else {
      weeks.push({ day: nextDay++, type: 'next' })
    }
  }

  function getDateExams(d) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return exams.filter(e => e.date === dateStr)
  }

  function getHoliday(d) {
    const key = `${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return FIXED_HOLIDAYS[key]
  }

  async function handleAddExam(e) {
    e.preventDefault()
    if (!newExam.title.trim() || !newExam.date) return
    await addDoc(collection(db, 'exam-schedule'), {
      title: newExam.title.trim(),
      date: newExam.date,
      subject: newExam.subject,
      author: nickname,
      createdAt: serverTimestamp(),
    })
    setNewExam({ title: '', date: '', subject: 'math' })
    setShowAddForm(false)
    addToast('시험 일정이 추가됐어요 📅', { icon: '✅' })
  }

  async function handleDeleteExam(id) {
    await deleteDoc(doc(db, 'exam-schedule', id))
  }

  // 이번 달 시험 일정
  const thisMonthExams = exams.filter(e => {
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  }).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            📅 시험 일정 캘린더
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* 월 이동 */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >◀</button>
          <span className="font-semibold text-gray-800">{year}년 {month + 1}월</span>
          <button
            onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >▶</button>
        </div>

        {/* 캘린더 그리드 */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-7 mb-1">
            {['일','월','화','수','목','금','토'].map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {weeks.map((cell, i) => {
              const isToday = cell.type === 'current' && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const holiday = cell.type === 'current' ? getHoliday(cell.day) : null
              const dayExams = cell.type === 'current' ? getDateExams(cell.day) : []
              const colIdx = i % 7
              return (
                <div key={i} className={`min-h-[48px] p-0.5 rounded ${cell.type !== 'current' ? 'opacity-30' : ''}`}>
                  <div className={`text-xs font-medium text-center mb-0.5 w-6 h-6 flex items-center justify-center mx-auto rounded-full
                    ${isToday ? 'bg-teal-500 text-white' : colIdx === 0 || holiday ? 'text-red-500' : colIdx === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                    {cell.day}
                  </div>
                  {holiday && <div className="text-[9px] text-red-400 text-center truncate">{holiday}</div>}
                  {dayExams.slice(0, 2).map((exam, ei) => (
                    <div key={exam.id}
                      className={`text-[9px] text-white rounded px-0.5 truncate ${EXAM_COLORS[ei % EXAM_COLORS.length]} cursor-pointer`}
                      onClick={() => handleDeleteExam(exam.id)}
                      title={`${exam.title} (클릭하면 삭제)`}
                    >
                      {exam.title}
                    </div>
                  ))}
                  {dayExams.length > 2 && <div className="text-[9px] text-gray-400 text-center">+{dayExams.length - 2}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* 이번 달 시험 목록 */}
        {thisMonthExams.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">이번 달 시험 일정</p>
            <div className="space-y-1">
              {thisMonthExams.map(exam => {
                const subj = getSubject(exam.subject)
                const d = new Date(exam.date + 'T00:00:00')
                const daysLeft = Math.ceil((d - new Date(new Date().toDateString())) / 86400000)
                return (
                  <div key={exam.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span>{subj.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{exam.title}</p>
                      <p className="text-xs text-gray-400">{exam.date} · {exam.author}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysLeft < 0 ? 'bg-gray-100 text-gray-400' : daysLeft === 0 ? 'bg-red-100 text-red-600' : daysLeft <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'}`}>
                      {daysLeft < 0 ? '완료' : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
                    </span>
                    <button onClick={() => handleDeleteExam(exam.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 시험 추가 */}
        <div className="px-4 pb-4">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 border-2 border-dashed border-teal-300 text-teal-500 rounded-xl text-sm hover:bg-teal-50 transition"
            >
              + 시험 일정 추가
            </button>
          ) : (
            <form onSubmit={handleAddExam} className="bg-teal-50 rounded-xl p-3 space-y-2">
              <input
                type="text"
                value={newExam.title}
                onChange={e => setNewExam(p => ({ ...p, title: e.target.value }))}
                placeholder="시험명 (예: 1학기 중간고사)"
                className="w-full px-3 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newExam.date}
                  onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <select
                  value={newExam.subject}
                  onChange={e => setNewExam(p => ({ ...p, subject: e.target.value }))}
                  className="px-2 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white text-sm py-2 rounded-lg font-medium transition">추가</button>
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm py-2 rounded-lg transition">취소</button>
              </div>
            </form>
          )}
        </div>
        <ToastContainer />
      </div>
    </div>
  )
}

export default function SubjectList({ onSelectSubject }) {
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '익명')
  const [todoCounts, setTodoCounts] = useState({})  // { subjectId: { total, done } }
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNameChange, setShowNameChange] = useState(false)
  const [newName, setNewName] = useState('')
  const [upcomingExams, setUpcomingExams] = useState([])
  const { addToast, ToastContainer } = useToast()

  // Pull-to-refresh
  const pullStartY = useRef(0)
  const [pulling, setPulling] = useState(false)

  useEffect(() => {
    // 전체 todos 실시간 구독해서 과목별 통계 집계
    const q = query(collection(db, 'study-todos'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      const counts = {}
      snap.docs.forEach(d => {
        const data = d.data()
        const sub = data.subject || 'other'
        if (!counts[sub]) counts[sub] = { total: 0, done: 0 }
        counts[sub].total++
        if (data.done) counts[sub].done++
      })
      setTodoCounts(counts)
    })
  }, [nickname])

  useEffect(() => {
    const q = query(collection(db, 'exam-schedule'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      const today = new Date(new Date().toDateString())
      const upcoming = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => {
          const d = new Date(e.date + 'T00:00:00')
          const diff = Math.ceil((d - today) / 86400000)
          return diff >= 0 && diff <= 14
        })
        .sort((a, b) => a.date.localeCompare(b.date))
      setUpcomingExams(upcoming)
    })
  }, [nickname])

  function handleNameChange(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || trimmed.length > 20) return
    localStorage.setItem(NICKNAME_KEY, trimmed)
    setNickname(trimmed)
    setShowNameChange(false)
    setNewName('')
    addToast(`이름이 "${trimmed}"으로 변경됐어요`, { icon: '✏️' })
  }

  // 전체 통계
  const totalAll = Object.values(todoCounts).reduce((a, c) => a + c.total, 0)
  const doneAll = Object.values(todoCounts).reduce((a, c) => a + c.done, 0)
  const progressAll = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

  const avatarColor = getAvatarColor(nickname)

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📚 스터디버디</h1>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 열심히 공부해요!</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCalendar(true)} className="p-2 bg-white rounded-xl shadow-sm hover:shadow text-teal-600 text-xl transition" title="시험 일정">
              📅
            </button>
            <button
              onClick={() => { setShowNameChange(true); setNewName(nickname) }}
              className={`w-9 h-9 rounded-full ${avatarColor} text-white text-sm font-bold flex items-center justify-center shadow-sm hover:shadow transition`}
              title="이름 변경"
            >
              {nickname[0]}
            </button>
          </div>
        </div>

        {/* 이름 변경 모달 */}
        {showNameChange && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowNameChange(false)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-800 mb-3">이름 변경</h3>
              <form onSubmit={handleNameChange} className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                  maxLength={20}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-2 rounded-lg font-medium">변경</button>
                  <button type="button" onClick={() => setShowNameChange(false)} className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-600 py-2 rounded-lg">취소</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 전체 진도 카드 */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-gray-500">전체 달성률</p>
              <p className="text-2xl font-bold text-teal-600">{progressAll}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">완료</p>
              <p className="font-bold text-gray-700">{doneAll} / {totalAll}</p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-teal-400 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressAll}%` }}
            />
          </div>
        </div>

        {/* 다가오는 시험 배너 */}
        {upcomingExams.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-red-600 mb-1.5">⚠️ 다가오는 시험</p>
            <div className="space-y-1">
              {upcomingExams.slice(0, 3).map(exam => {
                const today = new Date(new Date().toDateString())
                const d = new Date(exam.date + 'T00:00:00')
                const daysLeft = Math.ceil((d - today) / 86400000)
                const subj = getSubject(exam.subject)
                return (
                  <div key={exam.id} className="flex items-center gap-2 text-sm">
                    <span>{subj.emoji}</span>
                    <span className="text-gray-700 flex-1 truncate">{exam.title}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysLeft === 0 ? 'bg-red-500 text-white' : daysLeft <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 과목별 카드 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          {SUBJECTS.map(subj => {
            const counts = todoCounts[subj.id] || { total: 0, done: 0 }
            const progress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0
            const remaining = counts.total - counts.done

            return (
              <button
                key={subj.id}
                onClick={() => onSelectSubject(subj)}
                className={`${subj.bgClass} border ${subj.borderClass} rounded-2xl p-4 text-left hover:shadow-md active:scale-95 transition-all duration-150`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{subj.emoji}</span>
                  {remaining > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 ${subj.textClass}`}>
                      {remaining}
                    </span>
                  )}
                  {remaining === 0 && counts.total > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 text-emerald-600">✓</span>
                  )}
                </div>
                <p className={`font-bold ${subj.textClass} mb-1`}>{subj.label}</p>
                <p className="text-xs text-gray-500 mb-2">
                  {counts.total === 0 ? '할 일 없음' : `${counts.done}/${counts.total} 완료`}
                </p>
                <div className="w-full bg-white/60 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      progress === 100 ? 'bg-emerald-500' :
                      subj.id === 'math' ? 'bg-blue-400' :
                      subj.id === 'english' ? 'bg-emerald-400' :
                      subj.id === 'korean' ? 'bg-red-400' :
                      subj.id === 'science' ? 'bg-purple-400' :
                      subj.id === 'social' ? 'bg-amber-400' :
                      subj.id === 'history' ? 'bg-orange-400' : 'bg-gray-400'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* 안내 */}
        <p className="text-center text-xs text-gray-400 pb-4">
          과목을 탭하면 할 일 목록을 볼 수 있어요
        </p>
      </div>

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} nickname={nickname} />}
      <ToastContainer />
    </div>
  )
}
