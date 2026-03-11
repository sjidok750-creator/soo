import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp,
  deleteDoc, doc
} from 'firebase/firestore'
import { useToast } from './Toast'
import { SUBJECTS, getSubject } from './subjectConfig'

const NICKNAME_KEY = 'study-buddy-nickname'

const FIXED_HOLIDAYS = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
  '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
  '10-09': '한글날', '12-25': '성탄절',
}

const EXAM_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-purple-400', 'bg-blue-400', 'bg-teal-400']
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

function getTodayLabel() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${mm}/${dd}(${DAY_ABBR[now.getDay()]})`
}

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
  let day = 1, nextDay = 1
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDay) weeks.push({ day: prevMonthDays - firstDay + i + 1, type: 'prev' })
    else if (day <= daysInMonth) weeks.push({ day: day++, type: 'current' })
    else weeks.push({ day: nextDay++, type: 'next' })
  }

  function getDateExams(d) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return exams.filter(e => e.date === dateStr)
  }

  function getHoliday(d) {
    return FIXED_HOLIDAYS[`${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`]
  }

  async function handleAddExam(e) {
    e.preventDefault()
    if (!newExam.title.trim() || !newExam.date) return
    await addDoc(collection(db, 'exam-schedule'), {
      title: newExam.title.trim(), date: newExam.date, subject: newExam.subject,
      author: nickname, createdAt: serverTimestamp(),
    })
    setNewExam({ title: '', date: '', subject: 'math' })
    setShowAddForm(false)
    addToast('시험 일정이 추가됐어요 📅', { icon: '✅' })
  }

  async function handleDeleteExam(id) {
    await deleteDoc(doc(db, 'exam-schedule', id))
  }

  const thisMonthExams = exams.filter(e => {
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  }).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">📅 시험 일정 캘린더</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">◀</button>
          <span className="font-semibold text-gray-800">{year}년 {month + 1}월</span>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">▶</button>
        </div>
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
                    >{exam.title}</div>
                  ))}
                  {dayExams.length > 2 && <div className="text-[9px] text-gray-400 text-center">+{dayExams.length - 2}</div>}
                </div>
              )
            })}
          </div>
        </div>
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
        <div className="px-4 pb-4">
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-teal-300 text-teal-500 rounded-xl text-sm hover:bg-teal-50 transition">
              + 시험 일정 추가
            </button>
          ) : (
            <form onSubmit={handleAddExam} className="bg-teal-50 rounded-xl p-3 space-y-2">
              <input type="text" value={newExam.title} onChange={e => setNewExam(p => ({ ...p, title: e.target.value }))}
                placeholder="시험명 (예: 1학기 중간고사)"
                className="w-full px-3 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" autoFocus />
              <div className="flex gap-2">
                <input type="date" value={newExam.date} onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <select value={newExam.subject} onChange={e => setNewExam(p => ({ ...p, subject: e.target.value }))}
                  className="px-2 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
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
  const [nickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '익명')
  const [showCalendar, setShowCalendar] = useState(false)
  const [upcomingExams, setUpcomingExams] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const { ToastContainer } = useToast()
  const calendarRef = useRef(null)
  const todayCellRef = useRef(null)
  const todayLabel = getTodayLabel()
  const yearOptions = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1]

  useEffect(() => {
    const q = query(collection(db, 'exam-schedule'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      const todayStr = new Date().toDateString()
      const base = new Date(todayStr)
      const upcoming = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => {
          const d = new Date(e.date + 'T00:00:00')
          return Math.ceil((d - base) / 86400000) >= 0
        })
        .sort((a, b) => a.date.localeCompare(b.date))
      setUpcomingExams(upcoming)
    })
  }, [])

  // 오늘 날짜로 스크롤
  useEffect(() => {
    const timer = setTimeout(() => {
      todayCellRef.current?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  // 오늘 기준 앞뒤 60일 달력 데이터
  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)
  const calendarDays = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(todayBase)
    d.setDate(todayBase.getDate() - 30 + i)
    return d
  })

  function getDaysLeft(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return Math.ceil((d - new Date(new Date().toDateString())) / 86400000)
  }

  const dday1 = upcomingExams[0] || null
  const dday2 = upcomingExams[1] || null

  return (
    <div className="min-h-screen bg-white">

      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          {/* TODO LIST 배지 */}
          <div className="border-2 border-[#E8694A] rounded px-2 py-1 leading-none flex-shrink-0">
            <div className="text-[9px] font-bold text-[#E8694A] tracking-widest">TODO</div>
            <div className="text-[9px] font-bold text-[#E8694A] tracking-widest">LIST</div>
          </div>

          {/* 날짜 */}
          <span className="font-bold text-[#E8694A] text-sm tracking-tight">{todayLabel}</span>

          {/* 달력 아이콘 */}
          <button
            onClick={() => setShowCalendar(true)}
            className="text-[#E8694A] text-lg hover:opacity-70 transition flex-shrink-0"
          >
            📅
          </button>

          {/* 연도 선택 */}
          <div className="relative flex-shrink-0">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none border border-[#E8694A] text-[#E8694A] rounded-full px-3 pr-6 py-0.5 text-xs font-semibold bg-white focus:outline-none cursor-pointer"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#E8694A] text-[10px] pointer-events-none">▼</span>
          </div>

          <div className="flex-1" />

          {/* + 버튼 */}
          <button
            onClick={() => setShowCalendar(true)}
            className="w-9 h-9 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xl font-light flex items-center justify-center shadow-md transition flex-shrink-0"
          >
            +
          </button>
        </div>
      </div>

      {/* 한줄 가로 스크롤 달력 */}
      <div
        ref={calendarRef}
        className="flex gap-1.5 px-4 pb-5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {calendarDays.map((d, i) => {
          const isToday = d.getTime() === todayBase.getTime()
          const isSun = d.getDay() === 0
          const isSat = d.getDay() === 6
          const isFirstOfMonth = d.getDate() === 1
          return (
            <div
              key={i}
              ref={isToday ? todayCellRef : null}
              className={`flex-shrink-0 w-10 flex flex-col items-center pt-1.5 pb-2 rounded-2xl
                ${isToday
                  ? 'bg-[#E8694A]'
                  : 'bg-gray-50 hover:bg-gray-100'
                }`}
            >
              {/* 요일 */}
              <span className={`text-[10px] font-medium
                ${isToday ? 'text-white/80' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400'}`}>
                {DAY_KR[d.getDay()]}
              </span>
              {/* 날짜 */}
              <span className={`text-sm font-bold mt-0.5
                ${isToday ? 'text-white' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>
                {d.getDate()}
              </span>
              {/* 월 표시 (매월 1일) */}
              {isFirstOfMonth && (
                <span className={`text-[8px] mt-0.5 font-semibold
                  ${isToday ? 'text-white/70' : 'text-gray-400'}`}>
                  {d.getMonth() + 1}월
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* D-day 카운터 2개 (좌측 정렬, 병렬) */}
      <div className="px-4 flex gap-3">

        {/* D-day 카운터 1 — 코랄 */}
        <div className="w-36 rounded-2xl p-4 shadow-sm" style={{ backgroundColor: '#E8694A' }}>
          {dday1 ? (
            <>
              <p className="text-[11px] text-white/80 font-medium truncate">
                {getSubject(dday1.subject).emoji} {dday1.title}
              </p>
              <p className="text-3xl font-extrabold text-white mt-1 tracking-tight">
                {getDaysLeft(dday1.date) === 0 ? 'D-Day' : `D-${getDaysLeft(dday1.date)}`}
              </p>
              <p className="text-[10px] text-white/60 mt-1">{dday1.date}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-white/70">다음 시험</p>
              <p className="text-xl font-bold text-white/40 mt-1">없음</p>
            </>
          )}
        </div>

        {/* D-day 카운터 2 — 인디고 */}
        <div className="w-36 bg-indigo-500 rounded-2xl p-4 shadow-sm">
          {dday2 ? (
            <>
              <p className="text-[11px] text-white/80 font-medium truncate">
                {getSubject(dday2.subject).emoji} {dday2.title}
              </p>
              <p className="text-3xl font-extrabold text-white mt-1 tracking-tight">
                {getDaysLeft(dday2.date) === 0 ? 'D-Day' : `D-${getDaysLeft(dday2.date)}`}
              </p>
              <p className="text-[10px] text-white/60 mt-1">{dday2.date}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-white/70">다음 시험</p>
              <p className="text-xl font-bold text-white/40 mt-1">없음</p>
            </>
          )}
        </div>

      </div>

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} nickname={nickname} />}
      <ToastContainer />
    </div>
  )
}
