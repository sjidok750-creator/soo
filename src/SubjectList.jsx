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

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

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

/* ── 오늘의 영단어 ── */
const DAILY_WORDS = [
  'abundant','adequate','ambiguous','ambivalent','analogy',
  'anticipate','articulate','authentic','benevolent','brevity',
  'candid','clarity','cognitive','compassion','concise',
  'conscientious','contemplate','courage','curiosity','dedicate',
  'deliberate','diligent','discern','eloquent','empathy',
  'emphasis','endeavor','ephemeral','essence','flourish',
  'fluent','fortitude','frugal','genuine','gratitude',
  'harmony','humility','illuminate','immense','insight',
  'inspire','integrity','intrinsic','justice','legacy',
  'lucid','manifest','meticulous','nuance','optimism',
  'paradigm','patience','persevere','profound','resilience',
  'serendipity','solitude','tangible','tenacious','tranquil',
  'ubiquitous','versatile','vigilant','zealous','aspire',
]

function WordOfDay() {
  const kstDay = Math.floor((Date.now() + 9 * 3600000) / 86400000)
  const todayWord = DAILY_WORDS[kstDay % DAILY_WORDS.length]
  const cacheKey = `wod-${todayWord}`
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey)
    if (cached) { setData(JSON.parse(cached)); setLoading(false); return }
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${todayWord}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.[0]) { setLoading(false); return }
        const e = json[0]
        const phonetic = e.phonetic || e.phonetics?.find(p => p.text)?.text || ''
        const m = e.meanings || []
        const pos1 = m[0]?.partOfSpeech?.slice(0, 4) || ''
        const def1 = m[0]?.definitions[0]?.definition || ''
        const pos2 = m[1]?.partOfSpeech?.slice(0, 4) || m[0]?.partOfSpeech?.slice(0, 4) || ''
        const def2 = m[1]?.definitions[0]?.definition || m[0]?.definitions[1]?.definition || ''
        const result = { word: todayWord, phonetic, pos1, def1, pos2, def2 }
        localStorage.setItem(cacheKey, JSON.stringify(result))
        setData(result)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-1 flex flex-col justify-between min-w-0 animate-pulse">
      <div className="h-2 bg-gray-100 rounded w-16" />
      <div>
        <div className="h-4 bg-gray-100 rounded w-24 mb-1" />
        <div className="h-2.5 bg-gray-100 rounded w-14" />
      </div>
      <div className="space-y-1">
        <div className="h-2.5 bg-gray-100 rounded w-full" />
        <div className="h-2.5 bg-gray-100 rounded w-4/5" />
      </div>
    </div>
  )

  const d = data ?? { word: todayWord, phonetic: '', pos1: '', def1: '', pos2: '', def2: '' }
  return (
    <div className="flex-1 flex flex-col justify-between min-w-0">
      <p className="text-[8px] tracking-[0.18em] text-gray-300 uppercase leading-none">word of the day</p>
      <div>
        <p className="text-[15px] font-bold text-gray-700 leading-tight">{d.word}</p>
        {d.phonetic && (
          <p className="text-[10px] mt-0.5 leading-none" style={{ color: '#E8694A', opacity: 0.6 }}>{d.phonetic}</p>
        )}
      </div>
      <div className="space-y-0.5">
        {d.def1 && (
          <p className="text-[10px] text-gray-500 leading-tight line-clamp-1">
            <span className="text-gray-300 italic">{d.pos1}. </span>{d.def1}
          </p>
        )}
        {d.def2 && (
          <p className="text-[10px] text-gray-500 leading-tight line-clamp-1">
            <span className="text-gray-300 italic">{d.pos2}. </span>{d.def2}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── D-day 카드 (컴팩트 선 스타일) ── */
function DdayCard({ dday, onClick }) {
  const days = dday.date
    ? Math.ceil((new Date(dday.date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000)
    : null
  const label = days === null ? '—' : days === 0 ? 'Day' : String(Math.abs(days))
  const isPast = days !== null && days < 0
  const c = isPast ? '#d1d5db' : '#E8694A'

  return (
    <button
      onClick={onClick}
      className="w-[88px] flex-shrink-0 flex flex-col justify-between text-left active:opacity-70 transition-opacity"
    >
      <p className="text-[11px] font-semibold text-gray-600 truncate leading-none">
        {dday.title || 'tap to set'}
      </p>
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-px flex-1" style={{ backgroundColor: c }} />
          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
        </div>
        <p className="leading-none tracking-tight" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <span className="text-xs font-bold" style={{ color: c }}>D-</span>
          <span className="text-2xl font-black" style={{ color: c }}>{label}</span>
        </p>
      </div>
      <p className="text-[9px] text-gray-300 leading-none">{dday.date || '날짜 미설정'}</p>
    </button>
  )
}

export default function SubjectList({ onSelectSubject }) {
  const [nickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '익명')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dday, setDday] = useState(() => parseDday(localStorage.getItem('dday2')))
  const [showDdayPicker, setShowDdayPicker] = useState(false)
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

  function handleDdaySelect(value) {
    setDday(value)
    localStorage.setItem('dday2', JSON.stringify(value))
    setShowDdayPicker(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-16">

      {/* 헤더 — 고정 */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-1.5"
            style={{ border: '2.5px solid #E8694A', backgroundColor: '#FFF3F0', minWidth: 52 }}
          >
            <span className="text-[11px] font-extrabold tracking-[0.2em] text-[#E8694A] leading-tight">TODO</span>
            <div className="w-full my-0.5" style={{ height: 1.5, backgroundColor: '#E8694A', opacity: 0.35 }} />
            <span className="text-[11px] font-extrabold tracking-[0.2em] text-[#E8694A] leading-tight">LIST</span>
          </div>
          <span className="font-bold text-[#E8694A] text-sm tracking-tight">{todayLabel}</span>
          <button onClick={() => setShowCalendar(true)} className="text-[#E8694A] text-lg hover:opacity-70 transition flex-shrink-0">📅</button>
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
          <button
            onClick={() => setShowCalendar(true)}
            className="w-9 h-9 rounded-full text-white text-xl font-light flex items-center justify-center shadow-md transition flex-shrink-0"
            style={{ backgroundColor: '#E8694A' }}
          >+</button>
        </div>
      </div>

      {/* 한줄 가로 스크롤 달력 */}
      <div
        ref={calendarRef}
        className="flex gap-0 px-3 py-3 overflow-x-auto border-b border-gray-100/60"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {calendarDays.map((d, i) => {
          const isToday = d.getTime() === todayBase.getTime()
          const isFirstOfMonth = d.getDate() === 1
          return (
            <div key={i} ref={isToday ? todayCellRef : null} className="flex-shrink-0 w-9 flex flex-col items-center py-1">
              <span className="text-[8px] font-bold text-gray-500 mb-0.5 leading-none">{DAY_ABBR[d.getDay()]}</span>
              <span className={`text-[8px] font-semibold leading-none mb-0.5 ${isFirstOfMonth ? '' : 'invisible'}`}
                style={{ color: '#E8694A' }}
              >{MONTH_EN[d.getMonth()]}</span>
              <span
                className={`text-[13px] leading-none font-medium ${isToday ? 'font-bold' : 'text-gray-500'}`}
                style={isToday ? { color: '#E8694A' } : {}}
              >{d.getDate()}</span>
              {isToday
                ? <div className="w-1 h-1 rounded-full mt-1" style={{ backgroundColor: '#E8694A' }} />
                : <div className="w-1 h-1 mt-1" />
              }
            </div>
          )
        })}
      </div>

      {/* 영단어 + D-day — 동일 높이 */}
      <div className="px-5 py-4 flex items-stretch gap-4 border-b border-gray-100/60" style={{ minHeight: 90 }}>
        <WordOfDay />
        <div className="w-px bg-gray-100 self-stretch flex-shrink-0" />
        <DdayCard dday={dday} onClick={() => setShowDdayPicker(true)} />
      </div>

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} nickname={nickname} />}
      {showDdayPicker && <DdayPickerModal onSelect={handleDdaySelect} onClose={() => setShowDdayPicker(false)} />}
      <ToastContainer />

      {/* 하단 네비게이션 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 flex items-center justify-around h-16 px-1">
        {/* Task */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <span className="text-[9px] font-medium text-gray-700 leading-none">Task</span>
        </button>
        {/* Search */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="text-[9px] font-medium text-gray-700 leading-none">Search</span>
        </button>
        {/* Add (중앙) */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full" onClick={() => setShowCalendar(true)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span className="text-[9px] font-medium text-gray-700 leading-none">Add</span>
        </button>
        {/* Like */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
          <span className="text-[9px] font-medium text-gray-700 leading-none">Like</span>
        </button>
        {/* Stats */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
            <line x1="3" y1="20" x2="21" y2="20"/>
          </svg>
          <span className="text-[9px] font-medium text-gray-700 leading-none">Stats</span>
        </button>
      </div>
    </div>
  )
}
