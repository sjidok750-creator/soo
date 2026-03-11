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

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function getTodayLabel() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${mm}/${dd}(${DAY_ABBR[now.getDay()]})`
}

function parseDday(raw) {
  if (!raw) return { date: '', title: '' }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
    return { date: String(parsed), title: '' }
  } catch {
    return { date: raw, title: '' }
  }
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
                      className="text-[9px] text-white rounded px-0.5 truncate cursor-pointer"
                      style={{ backgroundColor: ei === 0 ? '#E8694A' : '#6366f1' }}
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

/* ── D-day 2단계 픽커: 날짜 → 제목 ── */
function DdayPickerModal({ onSelect, onClose }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [title, setTitle] = useState('')

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function handleDateClick(d) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    setSelectedDate(`${year}-${mm}-${dd}`)
  }

  function handleConfirm() {
    onSelect({ date: selectedDate, title: title.trim() })
  }

  /* 제목 입력 단계 */
  if (selectedDate) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-t-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* 드래그 핸들 */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
          <div className="px-6 pt-4 pb-10">
            <p className="text-xs tracking-widest text-gray-300 mb-1 uppercase">{selectedDate}</p>
            <p className="text-base font-bold text-gray-700 mb-6">어떤 날인가요?</p>
            <div className="relative mb-8">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="수능, 기말고사, 생일..."
                maxLength={20}
                className="w-full bg-transparent border-0 border-b-2 pb-2 text-xl outline-none placeholder-gray-200 text-gray-700"
                style={{ borderColor: '#E8694A', fontFamily: 'inherit' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && title.trim() && handleConfirm()}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedDate(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-400 text-sm"
              >
                ← 날짜 다시
              </button>
              <button
                onClick={handleConfirm}
                disabled={!title.trim()}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-30 transition"
                style={{ backgroundColor: '#E8694A' }}
              >
                설정
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* 날짜 선택 단계 */
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-3">
          <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-sm">◀</button>
          <span className="font-bold text-gray-700 text-sm tracking-wide">{year}년 {month + 1}월</span>
          <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-sm">▶</button>
        </div>
        <div className="grid grid-cols-7 px-4 mb-1">
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} className="text-center text-[11px] text-gray-300 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 px-4 gap-y-1 pb-8">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            return (
              <button key={i} onClick={() => handleDateClick(d)}
                className="w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm transition"
                style={isToday
                  ? { backgroundColor: '#E8694A', color: '#fff', fontWeight: 700 }
                  : { color: '#6b7280' }
                }
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── D-day 카드 (선 스타일) ── */
function DdayCard({ dday, onClick }) {
  const days = dday.date
    ? Math.ceil((new Date(dday.date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000)
    : null

  const label = days === null ? null : days === 0 ? 'Day' : String(Math.abs(days))
  const isPast = days !== null && days < 0

  return (
    <button
      onClick={onClick}
      className="flex-1 text-left py-3 px-1 active:opacity-70 transition-opacity"
    >
      {/* 제목 */}
      <p className="text-[11px] tracking-widest text-gray-300 mb-3 truncate uppercase">
        {dday.title || 'tap to set'}
      </p>
      {/* 수평선 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1" style={{ backgroundColor: '#E8694A', opacity: isPast ? 0.3 : 1 }} />
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#E8694A', opacity: isPast ? 0.3 : 1 }} />
      </div>
      {/* D-숫자 */}
      <p className="leading-none tracking-tight" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <span
          className="text-base font-bold"
          style={{ color: isPast ? '#d1d5db' : '#E8694A' }}
        >D-</span>
        <span
          className="text-4xl font-black"
          style={{ color: isPast ? '#d1d5db' : '#E8694A' }}
        >
          {label ?? '—'}
        </span>
      </p>
      {/* 날짜 */}
      <p className="text-[10px] text-gray-300 mt-1.5 tracking-wide">
        {dday.date || '날짜 미설정'}
      </p>
    </button>
  )
}

export default function SubjectList({ onSelectSubject }) {
  const [nickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '익명')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dday1, setDday1] = useState(() => parseDday(localStorage.getItem('dday1')))
  const [dday2, setDday2] = useState(() => parseDday(localStorage.getItem('dday2')))
  const [ddayPicker, setDdayPicker] = useState(null) // 1 or 2
  const { ToastContainer } = useToast()
  const calendarRef = useRef(null)
  const todayCellRef = useRef(null)
  const todayLabel = getTodayLabel()
  const yearOptions = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1]

  useEffect(() => {
    const timer = setTimeout(() => {
      todayCellRef.current?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)
  const calendarDays = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(todayBase)
    d.setDate(todayBase.getDate() - 30 + i)
    return d
  })

  function handleDdaySelect(slot, value) {
    const json = JSON.stringify(value)
    if (slot === 1) { setDday1(value); localStorage.setItem('dday1', json) }
    else { setDday2(value); localStorage.setItem('dday2', json) }
    setDdayPicker(null)
  }

  return (
    <div className="min-h-screen bg-white">

      {/* 헤더 — 아래 경계선 */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {/* TODO LIST 배지 */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-1.5"
            style={{ border: '2.5px solid #E8694A', backgroundColor: '#FFF3F0', minWidth: 52 }}
          >
            <span className="text-[11px] font-extrabold tracking-[0.2em] text-[#E8694A] leading-tight">TODO</span>
            <div className="w-full my-0.5" style={{ height: 1.5, backgroundColor: '#E8694A', opacity: 0.35 }} />
            <span className="text-[11px] font-extrabold tracking-[0.2em] text-[#E8694A] leading-tight">LIST</span>
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
            className="w-9 h-9 rounded-full text-white text-xl font-light flex items-center justify-center shadow-md transition flex-shrink-0"
            style={{ backgroundColor: '#E8694A' }}
          >
            +
          </button>
        </div>
      </div>

      {/* 한줄 가로 스크롤 달력 — 미니멀 */}
      <div
        ref={calendarRef}
        className="flex gap-0 px-3 py-3 overflow-x-auto border-b border-gray-100/60"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {calendarDays.map((d, i) => {
          const isToday = d.getTime() === todayBase.getTime()
          const isFirstOfMonth = d.getDate() === 1
          return (
            <div
              key={i}
              ref={isToday ? todayCellRef : null}
              className="flex-shrink-0 w-9 flex flex-col items-center py-1"
            >
              {/* 요일 */}
              <span className="text-[9px] text-gray-300 mb-1 leading-none">
                {DAY_KR[d.getDay()]}
              </span>
              {/* 날짜 */}
              <span
                className={`text-[13px] leading-none font-medium ${isToday ? 'font-bold' : 'text-gray-500'}`}
                style={isToday ? { color: '#E8694A' } : {}}
              >
                {d.getDate()}
              </span>
              {/* 오늘 도트 */}
              {isToday
                ? <div className="w-1 h-1 rounded-full mt-1" style={{ backgroundColor: '#E8694A' }} />
                : <div className="w-1 h-1 mt-1" />
              }
              {/* 월 레이블 (매월 1일, 오늘 제외) */}
              {isFirstOfMonth && !isToday && (
                <span className="text-[8px] text-gray-300 mt-0.5 leading-none">
                  {d.getMonth() + 1}월
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* D-day 2개 — 선 스타일 */}
      <div className="px-5 pt-4 pb-2 flex gap-6">
        <DdayCard dday={dday1} onClick={() => setDdayPicker(1)} />
        {/* 구분선 */}
        <div className="w-px bg-gray-100 self-stretch my-1 flex-shrink-0" />
        <DdayCard dday={dday2} onClick={() => setDdayPicker(2)} />
      </div>

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} nickname={nickname} />}
      {ddayPicker && (
        <DdayPickerModal
          onSelect={v => handleDdaySelect(ddayPicker, v)}
          onClose={() => setDdayPicker(null)}
        />
      )}
      <ToastContainer />
    </div>
  )
}
