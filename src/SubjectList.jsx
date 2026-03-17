import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import {
  collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp,
  deleteDoc, doc, updateDoc, setDoc
} from 'firebase/firestore'
import { useToast } from './Toast'
import { SUBJECTS, getSubject, DAILY_SUBJECTS, getDailySubject } from './subjectConfig'
import PullToRefreshWrapper from './PullToRefreshWrapper'

const NICKNAME_KEY = 'study-buddy-nickname'

const FIXED_HOLIDAYS = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
  '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
  '10-09': '한글날', '12-25': '성탄절',
}

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function getTodayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function timeToMins(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
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

function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    let startY = 0, startX = 0, canPull = false
    const onStart = (e) => {
      startY = e.touches[0].clientY; startX = e.touches[0].clientX
      canPull = (window.scrollY || document.documentElement.scrollTop) === 0
    }
    const onEnd = (e) => {
      if (!canPull) return
      const dy = e.changedTouches[0].clientY - startY
      const dx = Math.abs(e.changedTouches[0].clientX - startX)
      if (dy > 80 && dx < 40) { setRefreshing(true); setTimeout(() => setRefreshing(false), 700) }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend',   onEnd,   { passive: true })
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [])
  return refreshing
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
                className="w-full px-3 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                style={{ fontSize: 16 }} autoFocus />
              <div className="flex gap-2">
                <input type="date" value={newExam.date} onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  style={{ fontSize: 16 }} />
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

/* ── 잠뜰TV 유튜브 플레이어 바텀시트 ── */
function YouTubeVideoSheet({ video, onClose }) {
  const [minimized, setMinimized] = useState(false)

  /* 최소화 상태: iframe은 DOM에 유지(오디오 계속 재생), 앱 자유롭게 사용 가능 */
  if (minimized) {
    return (
      <div className="fixed inset-x-0 z-50 max-w-lg mx-auto px-2" style={{ bottom: 68 }}>
        {/* 오디오 유지용 숨김 iframe */}
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
          title="yt-bg-audio"
          allow="autoplay; encrypted-media"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 'none' }}
        />
        {/* 미니바 */}
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-2xl shadow-2xl"
          style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold line-clamp-1 leading-tight">{video.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>재생 중</span>
            </div>
          </div>
          <button
            onClick={() => setMinimized(false)}
            className="px-2.5 py-1 rounded-lg active:opacity-60 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          >펼치기</button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center active:opacity-60 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}
          >✕</button>
        </div>
      </div>
    )
  }

  /* 전체 플레이어 — top 없음 → 앱 위쪽 영역 터치 가능 */
  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div
        className="rounded-t-3xl overflow-hidden shadow-2xl"
        style={{ background: '#0F172A' }}
      >
        {/* handle */}
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </div>
        {/* header */}
        <div className="flex items-center gap-3 px-5 pt-3 pb-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden shadow-md">
            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight line-clamp-1">{video.title}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,0,0,0.2)' }}>
                <svg width="6" height="6" viewBox="0 0 10 10" fill="#FF4444"><polygon points="2,1 9,5 2,9" /></svg>
                <span className="text-[8px] font-bold" style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono, monospace' }}>잠뜰TV</span>
              </div>
              {video.pubDate && (
                <span className="text-[8px] text-gray-600" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {video.pubDate.slice(0, 10)}
                </span>
              )}
            </div>
          </div>
          {/* 최소화 버튼 */}
          <button
            onClick={() => setMinimized(true)}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1 }}
          >—</button>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >✕</button>
        </div>
        {/* 16:9 iframe */}
        <div style={{ position: 'relative', paddingBottom: '56.25%', backgroundColor: '#000' }}>
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        {/* safe area bottom */}
        <div style={{ height: 'calc(20px + env(safe-area-inset-bottom, 0px))', background: '#0F172A' }} />
      </div>
    </div>
  )
}

/* ── 잠뜰TV 최근 영상 썸네일 ── */
const JAMDDAL_CH = 'UCg7rkxrTnIhiHEpXY1ec9NA'

function JamDdalVideos({ onSelect }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cacheKey = `jamddal-${new Date().toDateString()}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try { setVideos(JSON.parse(cached)); setLoading(false); return } catch {}
    }
    const rssUrl = encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?channel_id=${JAMDDAL_CH}`)
    fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.status === 'ok' && data.items?.length) {
          const vids = data.items.slice(0, 10).map(item => {
            const id = item.link?.split('v=')[1]?.split('&')[0]
            return { id, title: item.title, pubDate: item.pubDate,
              thumbnail: id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null }
          }).filter(v => v.id && v.thumbnail)
          sessionStorage.setItem(cacheKey, JSON.stringify(vids))
          setVideos(vids)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center gap-2 py-3" style={{ overflowX: 'hidden' }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="flex-shrink-0 rounded-xl bg-gray-100 animate-pulse" style={{ width: 84, height: 48 }} />
      ))}
    </div>
  )

  if (!videos.length) return (
    <div className="flex-1 flex items-center">
      <span className="text-[10px] text-gray-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>영상 로드 실패</span>
    </div>
  )

  return (
    <div className="flex-1 flex items-center gap-2 py-3 min-w-0"
      style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {videos.map(video => (
        <button
          key={video.id}
          onClick={() => onSelect(video)}
          className="flex-shrink-0 rounded-xl overflow-hidden active:scale-95 transition-transform shadow-sm"
          style={{ width: 84, height: 48, scrollSnapAlign: 'start' }}
        >
          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        </button>
      ))}
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
function TodoInputSheet({ nickname, onClose, date }) {
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [customName, setCustomName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [added, setAdded] = useState(false)
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
        date: date || getTodayStr(), author: nickname || '익명',
        done: false, createdAt: serverTimestamp(), order: Date.now(),
      })
      setText('')
      setAdded(true)
      setTimeout(() => setAdded(false), 1800)
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
      {/* 백드롭 — stone 톤 딤 */}
      <div
        className="fixed inset-0 z-[49]"
        style={{ background: 'rgba(28,25,23,0.32)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
      {/* 시트 */}
      <div
        className="fixed inset-x-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          bottom: 64,
          maxHeight: '60vh',
          background: '#fff',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.14)',
        }}
      >
        {/* 상단 코랄 액센트 바 */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #F5A58A 0%, #E8694A 50%, #D4845A 100%)' }} />
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 3px)' }}>
          <div className="px-5 pt-4 pb-6">
            {/* handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'rgba(232,105,74,0.2)' }} />
            {/* close */}
            <div className="flex items-center justify-end mb-3">
              <button onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: '#FFF3F0', color: '#E8694A' }}>✕</button>
            </div>
            {/* textarea */}
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="What to study..."
              className="w-full rounded-2xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none mb-4"
              style={{ background: '#FAFAF9', border: '1.5px solid #F0EDE8', fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}
              rows={2} />
            {/* subjects */}
            <div className="mb-4">
              <span className="text-[10px] font-black tracking-[0.18em] mb-2 block"
                style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>SUBJECT</span>
              <div className="flex flex-wrap gap-1.5">
                {DAILY_SUBJECTS.map(s => {
                  const sel = subject === s.id
                  return (
                    <button key={s.id} onClick={() => setSubject(s.id)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                      style={sel
                        ? { backgroundColor: s.color, borderColor: s.color, color: '#fff' }
                        : { backgroundColor: s.bg, borderColor: s.color + '60', color: s.color }
                      }>{s.name}</button>
                  )
                })}
              </div>
              {subject === 'custom' && (
                <input value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="과목명 직접 입력"
                  className="mt-2 w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ background: '#FAFAF9', border: '1.5px solid #F0EDE8', fontSize: 16 }} />
              )}
            </div>
            {/* time */}
            <div className="mb-5">
              <span className="text-[10px] font-black tracking-[0.18em] mb-2 block"
                style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>STUDY TIME</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 rounded-xl px-3 py-2.5"
                  style={{ background: '#FAFAF9', border: '1.5px solid #F0EDE8' }}>
                  <span className="text-[9px] font-black tracking-widest shrink-0"
                    style={{ color: '#C4B8AF', fontFamily: 'JetBrains Mono, monospace' }}>START</span>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none min-w-0"
                    style={{ fontSize: 16 }} />
                </div>
                <span className="shrink-0 text-sm font-light" style={{ color: '#D4C8C0' }}>→</span>
                <div className="flex items-center gap-1.5 flex-1 rounded-xl px-3 py-2.5"
                  style={{ background: '#FAFAF9', border: '1.5px solid #F0EDE8' }}>
                  <span className="text-[9px] font-black tracking-widest shrink-0"
                    style={{ color: '#C4B8AF', fontFamily: 'JetBrains Mono, monospace' }}>END</span>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none min-w-0"
                    style={{ fontSize: 16 }} />
                </div>
                {totalMins > 0 && (
                  <div className="px-2.5 py-1.5 rounded-xl text-xs font-black shrink-0"
                    style={{ backgroundColor: '#FFF3F0', color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>{totalMins}m</div>
                )}
              </div>
            </div>
            {/* buttons */}
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm font-bold"
                style={{ background: '#F5F3F0', color: '#B8AFA8' }}>CANCEL</button>
              <button onClick={handleAdd}
                className="py-3 rounded-2xl text-white text-sm font-black transition-all duration-300"
                style={{
                  background: added ? '#10B981' : 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)',
                  boxShadow: added ? '0 4px 12px rgba(16,185,129,0.3)' : '0 4px 16px rgba(232,105,74,0.35)',
                  flex: 2,
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.06em',
                }}>
                {added ? '✓ DONE!' : 'ADD'}
              </button>
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
          style={{ fontFamily: 'Pretendard, sans-serif', fontSize: 16 }}
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
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8694A]"
              style={{ fontSize: 16 }} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-bold mb-1 block tracking-widest">END</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E8694A]"
              style={{ fontSize: 16 }} />
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

  async function handleToggle(todo) {
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
      <div className="px-3 sm:px-4 pt-1 pb-2">
        {todos.map((todo, idx) => {
          const subj = getDailySubject(todo.subject)
          return (
            <div key={todo.id}
              className={`py-1.5 sm:py-2 select-none ${idx < todos.length - 1 ? 'border-b border-gray-200/50' : ''}`}
            >
              <div className="flex items-center gap-2">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(todo)}
                  className="flex-shrink-0 w-4 h-4 sm:w-[18px] sm:h-[18px] rounded border-2 flex items-center justify-center transition-all"
                  style={todo.done
                    ? { borderColor: '#E8694A', backgroundColor: '#E8694A' }
                    : { borderColor: '#D1D5DB' }}
                >
                  {todo.done && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {/* Content — 클릭하면 수정 */}
                <span
                  className={`flex-1 min-w-0 truncate text-[13px] sm:text-sm md:text-base leading-tight cursor-pointer active:opacity-60 ${todo.done ? 'line-through text-gray-300' : 'text-gray-800'}`}
                  style={{ fontFamily: 'Pretendard, sans-serif', fontWeight: 500 }}
                  onClick={() => setEditingTodo(todo)}
                >
                  {todo.text}
                </span>

                {/* Time 2줄 — 시작/종료 (고정 52px) */}
                <div
                  className="flex-shrink-0 flex flex-col items-end justify-center gap-px tabular-nums"
                  style={{ width: 52, fontFamily: 'JetBrains Mono, monospace' }}
                >
                  <span className="text-[9px] leading-none" style={{ color: '#9CA3AF' }}>
                    {todo.studyStart || '—'}
                  </span>
                  <span className="text-[9px] leading-none" style={{ color: '#C4B8AF' }}>
                    {todo.studyEnd || ''}
                  </span>
                </div>

                {/* Subject 배지 (고정 40px) */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-md px-1 py-0.5"
                  style={{
                    width: 40,
                    backgroundColor: todo.done ? '#F8FAFC' : subj.bg,
                  }}
                >
                  <span
                    className="text-[10px] font-black leading-none"
                    style={{
                      color: todo.done ? '#CBD5E1' : subj.color,
                      fontFamily: 'JetBrains Mono, monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 36,
                      display: 'block',
                    }}
                  >
                    {(todo.subject === 'custom' && todo.subjectName) ? todo.subjectName : subj.name}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {/* 합계 */}
        {totalMins > 0 && (
          <div className="flex justify-end items-center gap-1.5 pt-1.5 mt-1 border-t border-dashed border-gray-100">
            <span className="text-[9px] text-gray-400 tracking-widest uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Total</span>
            <span className="text-[10px] sm:text-[11px] font-bold" style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>
              {totalMins}min{totalMins >= 60 && ` · ${formatTotal(totalMins)}`}
            </span>
          </div>
        )}
      </div>

      {editingTodo && <EditTodoModal todo={editingTodo} onClose={() => setEditingTodo(null)} />}
    </>
  )
}

/* ───── StudyTimeGraph (24h Separated Donut Clock) ───── */
function StudyTimeGraph({ todos }) {
  const ts = todos.filter(t => t.studyStart && t.studyEnd && t.totalMinutes > 0)
  if (!ts.length) return null

  const totals = {}
  ts.forEach(t => { totals[t.subject] = (totals[t.subject] || 0) + (t.totalMinutes || 0) })
  const totalAllMins = Object.values(totals).reduce((a, b) => a + b, 0)

  const SIZE = 320
  const CX = SIZE / 2, CY = SIZE / 2   // 160, 160
  const R = 105
  const STROKE = 42   // 두꺼운 도넛
  const GAP = 14      // 세그먼트 간 분리 간격 (분)
  const FULL = 1440

  const minToAngle = m => (m / FULL) * 360 - 90
  const polarToXY = (angle, r) => ({
    x: CX + r * Math.cos(angle * Math.PI / 180),
    y: CY + r * Math.sin(angle * Math.PI / 180),
  })

  function arcPath(startMin, endMin) {
    const s = startMin + GAP / 2
    const e = endMin - GAP / 2
    if (e - s < 4) return ''
    const a1 = minToAngle(s), a2 = minToAngle(e)
    const p1 = polarToXY(a1, R), p2 = polarToXY(a2, R)
    const large = (e - s) > 720 ? 1 : 0
    return `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y}`
  }

  function arcMidXY(startMin, endMin) {
    return polarToXY(minToAngle((startMin + endMin) / 2), R)
  }

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const nowDot = polarToXY(minToAngle(nowMins), R + STROKE / 2 + 7)

  const LABEL_R = R + STROKE / 2 + 17
  const hourLabels = [
    { h: 0,  label: '00시' },
    { h: 6,  label: '06시' },
    { h: 12, label: '12시' },
    { h: 18, label: '18시' },
  ]

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
      <div className="flex justify-center pt-4 pb-4">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ width: '100%', maxWidth: SIZE, height: 'auto' }}>

          {/* 배경 링 */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={STROKE} />

          {/* 내부 눈금 (1h 간격, 링 내부) */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = minToAngle(i * 60)
            const inner = polarToXY(angle, R - STROKE / 2 - 2)
            const outer = polarToXY(angle, R - STROKE / 2 + (i % 6 === 0 ? 9 : i % 3 === 0 ? 6 : 3))
            return (
              <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke={i % 6 === 0 ? '#CBD5E1' : '#E2E8F0'}
                strokeWidth={i % 6 === 0 ? 1.5 : 0.8} />
            )
          })}

          {/* 공부 세션 아크 — 분리된 도넛 */}
          {ts.map((t, i) => {
            const subj = getDailySubject(t.subject)
            const sm = timeToMins(t.studyStart), em = timeToMins(t.studyEnd)
            const path = arcPath(sm, em)
            if (!path) return null
            const mid = arcMidXY(sm, em)
            const arcDeg = ((em - sm) / FULL) * 360
            return (
              <g key={i}>
                {/* 그림자 효과 */}
                <path d={path} fill="none" stroke={subj.color} strokeWidth={STROKE + 4}
                  strokeLinecap="round" opacity={0.15} />
                {/* 메인 아크 */}
                <path d={path} fill="none" stroke={subj.color} strokeWidth={STROKE}
                  strokeLinecap="round" opacity={0.92} />
                {/* 과목 약자 */}
                {arcDeg >= 9 && (
                  <text x={mid.x} y={mid.y - 7}
                    textAnchor="middle" dominantBaseline="central"
                    fill="rgba(255,255,255,0.97)"
                    fontSize={arcDeg >= 18 ? 9.5 : 7.5}
                    fontWeight={800}
                    fontFamily="JetBrains Mono, monospace">
                    {subj.abbr}
                  </text>
                )}
                {/* 공부시간 */}
                {arcDeg >= 13 && (
                  <text x={mid.x} y={mid.y + 8}
                    textAnchor="middle" dominantBaseline="central"
                    fill="rgba(255,255,255,0.82)"
                    fontSize={arcDeg >= 18 ? 8 : 6.5}
                    fontFamily="JetBrains Mono, monospace">
                    {formatTotal(t.totalMinutes)}
                  </text>
                )}
              </g>
            )
          })}

          {/* 시간 라벨 — 00시/06시/12시/18시 */}
          {hourLabels.map(({ h, label }) => {
            const pos = polarToXY(minToAngle(h * 60), LABEL_R)
            return (
              <text key={h} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                fill="#64748B" fontSize={11} fontWeight={700}
                fontFamily="JetBrains Mono, monospace">
                {label}
              </text>
            )
          })}

          {/* 현재 시각 인디케이터 */}
          <circle cx={nowDot.x} cy={nowDot.y} r={4.5} fill="#E8694A" />
          <circle cx={nowDot.x} cy={nowDot.y} r={8} fill="none" stroke="#E8694A" strokeWidth={1.2} opacity={0.3} />

          {/* 중앙 — done 카운트 */}
          <text x={CX} y={CY - 28} textAnchor="middle" dominantBaseline="central"
            fill="#94A3B8" fontSize={11} fontFamily="JetBrains Mono, monospace" fontWeight={600}>
            {todos.filter(t => t.done).length}/{todos.length} done
          </text>
          {/* 총 공부시간 */}
          <text x={CX} y={CY - 6} textAnchor="middle" dominantBaseline="central"
            fill="#E8694A" fontSize={24} fontFamily="JetBrains Mono, monospace" fontWeight={800}>
            {formatTotal(totalAllMins)}
          </text>
          {/* 응원 메시지 */}
          <text x={CX} y={CY + 20} textAnchor="middle" dominantBaseline="central"
            fill="#94A3B8" fontSize={9} fontFamily="Pretendard, sans-serif">
            수현아!
          </text>
          <text x={CX} y={CY + 34} textAnchor="middle" dominantBaseline="central"
            fill="#94A3B8" fontSize={9} fontFamily="Pretendard, sans-serif">
            오늘도 수고했어
          </text>
        </svg>
      </div>
    </div>
  )
}

/* ───── DailyBoard ───── */
function DailyBoard({ todos, selectedDate, onPrevDay, onNextDay, loading }) {
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [stampShown, setStampShown] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const isAllDone = todos.length > 0 && todos.every(t => t.done)

  const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
  const dateLabel = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}(${DAY_ABBR[d.getDay()]})`

  useEffect(() => {
    if (isAllDone && !stampShown) {
      setConfirmComplete(true)
    }
    if (!isAllDone) {
      setStampShown(false)
    }
  }, [isAllDone])

  useEffect(() => {
    setStampShown(false)
    setConfirmComplete(false)
  }, [selectedDate])

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > dy && Math.abs(dx) > 55) {
      if (dx > 0) onNextDay()
      else onPrevDay()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <div
      className="mx-4 mt-3 rounded-2xl overflow-hidden mb-3 relative"
      style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* COMPLETE 도장 오버레이 */}
      {stampShown && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none overflow-hidden rounded-2xl">
          <div
            style={{
              transform: 'rotate(-28deg)',
              border: '5px solid #16a34a',
              borderRadius: 10,
              padding: '10px 22px',
              color: '#16a34a',
              fontSize: 34,
              fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              opacity: 0.82,
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            COMPLETE
          </div>
        </div>
      )}

      {/* 최종 완료 확인 다이얼로그 */}
      {confirmComplete && !stampShown && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-2xl">
          <div className="bg-white rounded-2xl p-5 mx-4 shadow-xl w-full max-w-xs">
            <p className="text-center text-lg font-black text-gray-800 mb-1">🎉</p>
            <p className="text-center font-bold text-gray-800 mb-1">모든 할 일 완료!</p>
            <p className="text-center text-sm text-gray-400 mb-5">오늘 학습을 모두 끝냈나요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmComplete(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium"
              >아직요</button>
              <button
                onClick={() => { setStampShown(true); setConfirmComplete(false) }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: '#16a34a' }}
              >완료!</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-200/40">
        <div className="flex items-center gap-2">
          <div className="w-[3px] h-4 rounded-full" style={{ backgroundColor: '#E8694A' }} />
          <span
            className="text-[13px] font-black tracking-wide"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: '#2D2018' }}
          >todo list</span>
        </div>
        {/* 날짜 이동 버튼 */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevDay}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors active:bg-orange-50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4B8AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="text-[11px] font-black px-1"
            style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace', minWidth: 72, textAlign: 'center' }}>
            {dateLabel}
          </span>
          <button
            onClick={onNextDay}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors active:bg-orange-50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4B8AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
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

export default function SubjectList({ onSelectSubject, onOpenVocabScanner, onOpenTaskManager, showTodoInput, onCloseTodoInput }) {
  const [nickname] = useState(() => localStorage.getItem(NICKNAME_KEY) || '익명')
  const [showCalendar, setShowCalendar] = useState(false)
  const [localShowTodo, setLocalShowTodo] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [dday, setDday] = useState({ date: '', title: '' })
  const [showDdayPicker, setShowDdayPicker] = useState(false)
  // showTodoInput / onCloseTodoInput are managed by App.jsx (so nav persists across screens)
  const [playingVideo, setPlayingVideo] = useState(null)
  const [todayTodos, setTodayTodos] = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [todosLoading, setTodosLoading] = useState(false)
  const { addToast, ToastContainer } = useToast()
  const calendarRef = useRef(null)
  const todayCellRef = useRef(null)
  const todayLabel = getTodayLabel()
  const yearOptions = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1]

  function prevDay() {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  }
  function nextDay() {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      todayCellRef.current?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  // D-day 실시간 구독 (Firestore → localStorage 폴백)
  useEffect(() => {
    const saved = localStorage.getItem('study-buddy-dday')
    if (saved) try { setDday(JSON.parse(saved)) } catch {}
    return onSnapshot(
      doc(db, 'settings', 'dday'),
      snap => {
        if (snap.exists()) {
          setDday(snap.data())
          localStorage.setItem('study-buddy-dday', JSON.stringify(snap.data()))
        }
      },
      err => {
        console.error('D-day read error:', err)
      }
    )
  }, [])

  // 선택 날짜 투두 실시간 구독
  useEffect(() => {
    const today = getTodayStr()
    const colRef = collection(db, 'study-todos')
    const unsub = onSnapshot(
      colRef,
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.date === selectedDate)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        console.log('[study-todos] filtered for today:', items.length)
        setTodayTodos(items)
        setTodosLoading(false)
      },
      err => {
        console.error('[study-todos] onSnapshot error:', err.code, err.message)
        setTodosLoading(false)
        addToast(`❌ 투두 로드 실패: ${err.code}`)
      }
    )
    return unsub
  }, [selectedDate])

  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)
  const calendarDays = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(todayBase)
    d.setDate(todayBase.getDate() - 30 + i)
    return d
  })

  async function handleDdaySelect(value) {
    setDday(value)
    localStorage.setItem('study-buddy-dday', JSON.stringify(value))
    try { await setDoc(doc(db, 'settings', 'dday'), value) } catch (e) { console.error('D-day save:', e) }
    setShowDdayPicker(false)
  }

  return (
    <PullToRefreshWrapper onRefresh={() => setSelectedDate(getTodayStr())} bg="#F8FAF9">
    <div className="min-h-screen bg-stone-50 pb-16">

      {/* 헤더 — 고정 */}
      <div className="sticky top-0 z-40 bg-white px-4 pt-3 pb-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          {/* 달력 아이콘 버튼 */}
          <button
            onClick={() => setShowCalendar(true)}
            className="flex items-center justify-center rounded-lg p-2 transition hover:opacity-80 flex-shrink-0"
            style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
              className="appearance-none rounded-full px-3 pr-7 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
              style={{ border: '2px solid #E8694A', backgroundColor: '#FFF3F0', color: '#E8694A' }}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E8694A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const isToday = d.getTime() === todayBase.getTime()
          const isSelected = dateStr === selectedDate
          const isFirstOfMonth = d.getDate() === 1
          return (
            <button
              key={i}
              ref={isToday ? todayCellRef : null}
              className="flex-shrink-0 w-10 flex flex-col items-center py-1.5 rounded-xl transition-colors active:bg-orange-50"
              style={isSelected && !isToday ? { backgroundColor: '#FFF3F0' } : {}}
              onClick={() => setSelectedDate(dateStr)}
            >
              <span
                className="text-[9px] font-bold mb-0.5 leading-none"
                style={{ color: isToday ? '#E8694A' : '#A8A09A' }}
              >{DAY_ABBR[d.getDay()]}</span>
              <span
                className={`text-[8px] font-bold leading-none mb-0.5 ${isFirstOfMonth ? '' : 'invisible'}`}
                style={{ color: '#E8694A' }}
              >{MONTH_EN[d.getMonth()]}</span>
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: isToday ? 28 : 24,
                  height: isToday ? 28 : 24,
                  backgroundColor: isToday ? '#E8694A' : 'transparent',
                }}
              >
                <span
                  className="text-[13px] leading-none font-bold"
                  style={{
                    color: isToday ? 'white' : isSelected ? '#E8694A' : '#4B5563',
                  }}
                >{d.getDate()}</span>
              </div>
              {isSelected && !isToday
                ? <div className="w-[5px] h-[5px] rounded-full mt-0.5" style={{ backgroundColor: '#E8694A' }} />
                : <div className="w-[5px] h-[5px] mt-0.5" />
              }
            </button>
          )
        })}
      </div>

      {/* 잠뜰TV 최근 영상 + D-day */}
      <div className="px-4 flex items-stretch gap-3 border-b border-gray-100/60" style={{ minHeight: 72 }}>
        <JamDdalVideos onSelect={setPlayingVideo} />
        <div className="w-px bg-gray-100 flex-shrink-0" />
        <DdayCard dday={dday} onClick={() => setShowDdayPicker(true)} />
      </div>


      {/* Daily Board */}
      <DailyBoard
        todos={todayTodos}
        selectedDate={selectedDate}
        onPrevDay={prevDay}
        onNextDay={nextDay}
        loading={todosLoading}
      />
      <StudyTimeGraph todos={todayTodos} />

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} nickname={nickname} />}
      {showDdayPicker && <DdayPickerModal onSelect={handleDdaySelect} onClose={() => setShowDdayPicker(false)} />}
      {(showTodoInput || localShowTodo) && <TodoInputSheet nickname={nickname} onClose={() => { onCloseTodoInput?.(); setLocalShowTodo(false) }} date={selectedDate} />}
      {playingVideo && <YouTubeVideoSheet video={playingVideo} onClose={() => setPlayingVideo(null)} />}
      <ToastContainer />

    </div>
    </PullToRefreshWrapper>
  )
}
