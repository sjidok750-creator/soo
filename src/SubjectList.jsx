import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp,
  deleteDoc, doc, updateDoc, setDoc
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

const DAILY_SUBJECTS = [
  { id: 'kor',  name: '국어',      abbr: 'KOR',  color: '#EF4444', bg: '#FEF2F2' },
  { id: 'math', name: '수학',      abbr: 'MATH', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'eng',  name: '영어',      abbr: 'ENG',  color: '#059669', bg: '#ECFDF5' },
  { id: 'ss',   name: '사회',      abbr: 'SS',   color: '#D97706', bg: '#FFFBEB' },
  { id: 'kh',   name: '한국사',    abbr: 'KH',   color: '#EA580C', bg: '#FFF7ED' },
  { id: 'pl',   name: '정법',      abbr: 'PL',   color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'econ', name: '경제',      abbr: 'ECON', color: '#0D9488', bg: '#F0FDFA' },
  { id: 'ei',   name: '윤리와사상', abbr: 'EI',  color: '#4F46E5', bg: '#EEF2FF' },
  { id: 'sci',  name: '과학',      abbr: 'IS',   color: '#0891B2', bg: '#ECFEFF' },
  { id: 'phy',  name: '물리',      abbr: 'PHY',  color: '#6D28D9', bg: '#F5F3FF' },
  { id: 'chem', name: '화학',      abbr: 'CHEM', color: '#DB2777', bg: '#FDF2F8' },
  { id: 'bio',  name: '생명과학',  abbr: 'BIO',  color: '#65A30D', bg: '#F7FEE7' },
  { id: 'es',   name: '지구과학',  abbr: 'ES',   color: '#0284C7', bg: '#F0F9FF' },
  { id: 'custom', name: '직접입력', abbr: 'ETC', color: '#6B7280', bg: '#F9FAFB' },
]

function getTodayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function timeToMins(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
}
function getDailySubject(id) {
  return DAILY_SUBJECTS.find(s => s.id === id) || DAILY_SUBJECTS.at(-1)
}

function getTodayLabel() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${mm}/${dd}(${DAY_ABBR[now.getDay()]})`
}

function formatTotal(mins) {
  if (!mins || mins <= 0) return '0min'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
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

/* ───── TodoInputSheet ───── */
function TodoInputSheet({ nickname, onClose }) {
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [customName, setCustomName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const { addToast, ToastContainer } = useToast()

  const totalMins = (() => {
    const s = timeToMins(startTime), e = timeToMins(endTime)
    return e > s ? e - s : 0
  })()

  async function handleAdd() {
    if (!text.trim()) { addToast('내용을 입력해주세요'); return }
    if (!subject) { addToast('과목을 선택해주세요'); return }
    const subj = getDailySubject(subject)
    const subjectName = (subject === 'custom' && customName.trim()) ? customName.trim() : subj.name
    try {
      await addDoc(collection(db, 'study-todos'), {
        text: text.trim(), subject, subjectName,
        studyStart: startTime, studyEnd: endTime, totalMinutes: totalMins,
        date: getTodayStr(), author: nickname || '익명',
        done: false, createdAt: serverTimestamp(), order: Date.now(),
      })
      setText('')
      addToast('추가 완료!')
    } catch (err) {
      console.error('Firestore write error:', err)
      if (err.code === 'permission-denied') {
        addToast('❌ 저장 실패: Firebase 보안 규칙을 확인하세요')
      } else {
        addToast(`❌ 저장 실패: ${err.message}`)
      }
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ bottom: 64, maxHeight: '55vh' }}>
        <div className="overflow-y-auto h-full">
          <div className="px-5 pt-3 pb-6">
            {/* handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            {/* header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-gray-800">오늘의 할 일 추가</span>
              <button onClick={onClose}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">✕</button>
            </div>
            {/* text */}
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="할 일 내용을 입력하세요..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#E8694A] mb-4"
              rows={2} />
            {/* subjects */}
            <div className="mb-4">
              <span className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">과목 선택</span>
              <div className="flex flex-wrap gap-1.5">
                {DAILY_SUBJECTS.map(s => {
                  const sel = subject === s.id
                  return (
                    <button key={s.id} onClick={() => setSubject(s.id)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                      style={sel
                        ? { backgroundColor: s.color, borderColor: s.color, color: '#fff' }
                        : { backgroundColor: s.bg, borderColor: s.color + '80', color: s.color }
                      }>{s.name}</button>
                  )
                })}
              </div>
              {subject === 'custom' && (
                <input value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="과목명 직접 입력"
                  className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#E8694A]" />
              )}
            </div>
            {/* time */}
            <div className="mb-5">
              <span className="text-[11px] font-bold text-gray-400 tracking-widest mb-2 block">공부 시간</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-[10px] text-gray-400 font-medium shrink-0">시작</span>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none min-w-0" />
                </div>
                <span className="text-gray-300 text-base shrink-0">→</span>
                <div className="flex items-center gap-1.5 flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-[10px] text-gray-400 font-medium shrink-0">종료</span>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none min-w-0" />
                </div>
                {totalMins > 0 && (
                  <div className="px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0"
                    style={{ backgroundColor: '#FFF3F0', color: '#E8694A' }}>{totalMins}분</div>
                )}
              </div>
            </div>
            {/* buttons */}
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm text-gray-500 font-semibold">닫기</button>
              <button onClick={handleAdd}
                className="py-3 rounded-2xl text-white text-sm font-bold"
                style={{ backgroundColor: '#E8694A', flex: 2 }}>추가</button>
            </div>
          </div>
        </div>
        <ToastContainer />
      </div>
    </>
  )
}

/* ───── EditTodoModal ───── */
function EditTodoModal({ todo, onClose }) {
  const [text, setText] = useState(todo.text)
  const [subject, setSubject] = useState(todo.subject)
  const [startTime, setStartTime] = useState(todo.studyStart || '09:00')
  const [endTime, setEndTime] = useState(todo.studyEnd || '10:00')
  const { addToast, ToastContainer } = useToast()

  const totalMins = (() => {
    const s = timeToMins(startTime), e = timeToMins(endTime)
    return e > s ? e - s : 0
  })()

  async function handleSave() {
    if (!text.trim()) { addToast('내용을 입력해주세요'); return }
    try {
      await updateDoc(doc(db, 'study-todos', todo.id), {
        text: text.trim(), subject,
        subjectName: getDailySubject(subject).name,
        studyStart: startTime, studyEnd: endTime, totalMinutes: totalMins,
      })
      onClose()
    } catch (err) {
      addToast(`❌ 저장 실패: ${err.message}`)
    }
  }

  async function handleDelete() {
    try {
      await deleteDoc(doc(db, 'study-todos', todo.id))
      onClose()
    } catch (err) {
      addToast(`❌ 삭제 실패: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-4 pb-8">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-gray-800" style={{ fontFamily: 'Pretendard, sans-serif' }}>할 일 수정</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">✕</button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-[#E8694A] mb-3"
          style={{ fontFamily: 'Pretendard, sans-serif' }}
          rows={2} />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DAILY_SUBJECTS.map(s => (
            <button key={s.id} onClick={() => setSubject(s.id)}
              className="px-2.5 py-1 rounded-full text-xs font-bold border transition-all"
              style={subject === s.id
                ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                : { backgroundColor: s.bg, color: s.color, borderColor: s.color + '40' }}>
              {s.abbr}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-bold mb-1 block tracking-widest">START</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8694A]" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-bold mb-1 block tracking-widest">END</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8694A]" />
          </div>
          <div className="flex-shrink-0 flex flex-col justify-end">
            <span className="text-xs font-bold text-gray-500 pb-2">{formatTotal(totalMins)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete}
            className="flex-shrink-0 px-4 py-3 rounded-xl border border-red-200 text-red-400 text-sm font-bold">삭제</button>
          <button onClick={handleSave}
            className="flex-1 py-3 rounded-xl text-white text-sm font-bold"
            style={{ backgroundColor: '#E8694A' }}>저장</button>
        </div>
        <ToastContainer />
      </div>
    </div>
  )
}

/* ───── TodoList ───── */
function TodoList({ todos }) {
  const [editingTodo, setEditingTodo] = useState(null)
  const longPressTimer = useRef(null)

  function startPress(todo) {
    longPressTimer.current = setTimeout(() => setEditingTodo(todo), 600)
  }
  function cancelPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  async function handleToggle(todo) {
    cancelPress()
    try {
      await updateDoc(doc(db, 'study-todos', todo.id), { done: !todo.done })
    } catch {}
  }

  const totalMins = todos.reduce((s, t) => s + (t.totalMinutes || 0), 0)

  if (!todos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-300">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
        <p className="text-xs font-medium" style={{ fontFamily: 'Pretendard, sans-serif' }}>아직 할 일이 없어요</p>
      </div>
    )
  }

  return (
    <>
      <div className="px-4 pt-1 pb-2">
        {todos.map((todo, idx) => {
          const subj = getDailySubject(todo.subject)
          return (
            <div key={todo.id}
              className={`flex items-center gap-2.5 py-2.5 select-none ${idx < todos.length - 1 ? 'border-b border-gray-50' : ''}`}
              onMouseDown={() => startPress(todo)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={() => startPress(todo)}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
            >
              {/* Checkbox */}
              <button
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onClick={() => handleToggle(todo)}
                className="flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all"
                style={todo.done
                  ? { borderColor: '#E8694A', backgroundColor: '#E8694A' }
                  : { borderColor: '#D1D5DB' }}
              >
                {todo.done && (
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* Todo text */}
              <span
                className={`flex-1 text-sm leading-snug min-w-0 ${todo.done ? 'line-through text-gray-300' : 'text-gray-800'}`}
                style={{ fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}
              >
                {todo.text}
              </span>

              {/* Right: time + subject */}
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                {todo.studyStart && todo.studyEnd && (
                  <span className="text-[9px] text-gray-400 leading-none whitespace-nowrap" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {todo.studyStart}–{todo.studyEnd}
                    {todo.totalMinutes > 0 && ` (${todo.totalMinutes}m)`}
                  </span>
                )}
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white leading-none"
                  style={{ backgroundColor: subj.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {subj.abbr}
                </span>
              </div>
            </div>
          )
        })}

        {/* 합계 */}
        {totalMins > 0 && (
          <div className="flex justify-end items-center gap-1.5 pt-2 mt-1 border-t border-dashed border-gray-100">
            <span className="text-[9px] text-gray-400 tracking-widest uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Total</span>
            <span className="text-[11px] font-bold" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
              {totalMins}min{totalMins >= 60 && `, ${formatTotal(totalMins)}`}
            </span>
          </div>
        )}
      </div>

      {editingTodo && <EditTodoModal todo={editingTodo} onClose={() => setEditingTodo(null)} />}
    </>
  )
}

/* ───── StudyTimeGraph ───── */
function StudyTimeGraph({ todos }) {
  const ts = todos.filter(t => t.studyStart && t.studyEnd && t.totalMinutes > 0)
  if (!ts.length) return null

  const subjIds = [...new Set(ts.map(t => t.subject))]
  const totals = {}
  ts.forEach(t => { totals[t.subject] = (totals[t.subject] || 0) + (t.totalMinutes || 0) })
  const totalAllMins = Object.values(totals).reduce((a, b) => a + b, 0)

  // 실제 공부한 시간 범위 (±1시간 여유)
  const allM = ts.flatMap(t => [timeToMins(t.studyStart), timeToMins(t.studyEnd)])
  const rangeStart = Math.max(0, Math.floor((Math.min(...allM) - 60) / 60) * 60)
  const rangeEnd = Math.min(1440, Math.ceil((Math.max(...allM) + 60) / 60) * 60)
  const range = rangeEnd - rangeStart

  const pL = m => `${((m - rangeStart) / range * 100).toFixed(3)}%`
  const pW = (s, e) => `${((e - s) / range * 100).toFixed(3)}%`

  const hourMarkers = []
  for (let h = Math.ceil(rangeStart / 60); h <= Math.floor(rangeEnd / 60); h++) {
    hourMarkers.push(h * 60)
  }

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: '#0F172A' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full" style={{ backgroundColor: '#E8694A' }} />
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>
            Study Timeline
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
            {todos.filter(t => t.done).length}/{todos.length} done
          </span>
          <span className="text-[11px] font-bold" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
            {totalAllMins}min · {formatTotal(totalAllMins)}
          </span>
        </div>
      </div>

      {/* 차트 */}
      <div className="px-4 pb-4">
        <div className="flex items-start gap-2">
          {/* Y labels */}
          <div className="flex-shrink-0" style={{ width: 36, paddingTop: 2 }}>
            {subjIds.map(id => {
              const s = getDailySubject(id)
              return (
                <div key={id} className="flex items-center justify-end mb-1.5" style={{ height: 18 }}>
                  <span className="text-[9px] font-bold" style={{ color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>{s.abbr}</span>
                </div>
              )
            })}
          </div>

          {/* 바 영역 */}
          <div className="flex-1 relative">
            {subjIds.map(id => {
              const subj = getDailySubject(id)
              const sessions = ts.filter(t => t.subject === id)
              return (
                <div key={id} className="relative mb-1.5" style={{ height: 18 }}>
                  {/* 트랙 배경 */}
                  <div className="absolute inset-0 rounded-sm" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
                  {/* 그리드 라인 */}
                  {hourMarkers.map(h => (
                    <div key={h} className="absolute top-0 bottom-0" style={{
                      left: pL(h), width: 1,
                      backgroundColor: 'rgba(255,255,255,0.06)'
                    }} />
                  ))}
                  {/* 세션 바 */}
                  {sessions.map((s, i) => {
                    const sm = timeToMins(s.studyStart), em = timeToMins(s.studyEnd)
                    return (
                      <div key={i}
                        className="absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center overflow-hidden"
                        style={{ left: pL(sm), width: pW(sm, em), backgroundColor: subj.color }}>
                        {s.totalMinutes >= 25 && (
                          <span className="text-[7px] font-bold leading-none px-0.5"
                            style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {s.totalMinutes}m
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* X축 */}
            <div className="relative mt-1" style={{ height: 14 }}>
              {hourMarkers.map(h => (
                <span key={h}
                  className="absolute -translate-x-1/2 text-[8px]"
                  style={{
                    left: pL(h),
                    color: 'rgba(255,255,255,0.25)',
                    fontFamily: 'JetBrains Mono, monospace',
                    bottom: 0,
                  }}>
                  {`${String(Math.floor(h / 60)).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>
          </div>

          {/* 과목별 합계 */}
          <div className="flex-shrink-0 flex flex-col items-start gap-1.5" style={{ width: 44, paddingTop: 2 }}>
            {subjIds.map(id => {
              const subj = getDailySubject(id)
              return (
                <div key={id} className="flex items-center" style={{ height: 18 }}>
                  <span className="text-[8px] font-bold leading-none"
                    style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatTotal(totals[id])}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 하단 과목 칩 */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {subjIds.map(id => {
          const subj = getDailySubject(id)
          return (
            <span key={id} className="flex items-center gap-1 px-2 py-1 rounded"
              style={{ backgroundColor: subj.color + '22', fontFamily: 'JetBrains Mono, monospace' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: subj.color }} />
              <span className="text-[9px] font-bold" style={{ color: subj.color }}>{subj.abbr}</span>
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatTotal(totals[id])}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ───── DailyBoard ───── */
function DailyBoard({ todos, loading }) {
  const now = new Date()
  const dateLabel = `${now.getMonth() + 1}/${String(now.getDate()).padStart(2, '0')}(${DAY_ABBR[now.getDay()]})`
  return (
    <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-50">
        {/* todo list 배지 */}
        <span className="px-3 py-1 rounded-lg text-sm font-bold border-2"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: '#E8694A',
            borderColor: '#E8694A',
            backgroundColor: '#FFF7F5',
            letterSpacing: '0.04em',
          }}>
          todo list
        </span>
        {/* 날짜 */}
        <span className="text-[11px] font-bold"
          style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
          {dateLabel}
        </span>
      </div>
      <div className="min-h-[120px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300">
            <svg className="animate-spin mb-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <p className="text-xs font-medium">불러오는 중...</p>
          </div>
        ) : (
          <TodoList todos={todos} />
        )}
      </div>
    </div>
  )
}

export default function SubjectList({ onSelectSubject }) {
  const [nickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '익명')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dday, setDday] = useState({ date: '', title: '' })
  const [showDdayPicker, setShowDdayPicker] = useState(false)
  const [showTodoInput, setShowTodoInput] = useState(false)
  const [todayTodos, setTodayTodos] = useState([])
  const [todosLoading, setTodosLoading] = useState(false)
  const { addToast, ToastContainer } = useToast()
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

  // D-day 실시간 구독 (Firestore → 기기 간 동기화)
  useEffect(() => {
    return onSnapshot(
      doc(db, 'settings', 'dday'),
      snap => { if (snap.exists()) setDday(snap.data()) },
      err => { console.error('D-day read error:', err); addToast(`❌ D-day 로드 실패: ${err.code}`) }
    )
  }, [])

  // 오늘 투두 실시간 구독 (서버 측 날짜 필터링으로 전체 컬렉션 스캔 방지)
  useEffect(() => {
    const today = getTodayStr()
    const q = query(collection(db, 'study-todos'), where('date', '==', today))
    const unsub = onSnapshot(
      q,
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        setTodayTodos(items)
        setTodosLoading(false)
      },
      err => {
        console.error('Todos read error:', err)
        setTodosLoading(false)
        addToast(`❌ 투두 로드 실패: ${err.code}`)
      }
    )
    return unsub
  }, [])

  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)
  const calendarDays = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(todayBase)
    d.setDate(todayBase.getDate() - 30 + i)
    return d
  })

  async function handleDdaySelect(value) {
    await setDoc(doc(db, 'settings', 'dday'), value)
    setShowDdayPicker(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-16">

      {/* 헤더 — 고정 */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* 달력 아이콘 버튼 */}
          <button
            onClick={() => setShowCalendar(true)}
            className="flex items-center justify-center rounded-xl p-2.5 transition hover:opacity-80"
            style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="#E8694A" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="#E8694A" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="#E8694A" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="#E8694A" strokeWidth="2"/>
              <rect x="7" y="13" width="2.2" height="2.2" rx="0.4" fill="#E8694A"/>
              <rect x="11" y="13" width="2.2" height="2.2" rx="0.4" fill="#E8694A"/>
              <rect x="15" y="13" width="2.2" height="2.2" rx="0.4" fill="#E8694A"/>
              <rect x="7" y="17" width="2.2" height="2.2" rx="0.4" fill="#E8694A"/>
              <rect x="11" y="17" width="2.2" height="2.2" rx="0.4" fill="#E8694A"/>
            </svg>
          </button>
          {/* 년도 선택 */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none rounded-full px-4 pr-9 py-2 text-sm font-bold focus:outline-none cursor-pointer"
              style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0', color: '#E8694A' }}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
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

      {/* Daily Board */}
      <DailyBoard todos={todayTodos} loading={todosLoading} />
      <StudyTimeGraph todos={todayTodos} />

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} nickname={nickname} />}
      {showDdayPicker && <DdayPickerModal onSelect={handleDdaySelect} onClose={() => setShowDdayPicker(false)} />}
      {showTodoInput && <TodoInputSheet nickname={nickname} onClose={() => setShowTodoInput(false)} />}
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
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full" onClick={() => setShowTodoInput(true)}>
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
