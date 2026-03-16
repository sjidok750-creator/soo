import { useState } from 'react'
import SplashScreen from './SplashScreen'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'
import VocabScanner from './VocabScanner'
import TaskManager from './TaskManager'
import NotesPage from './NotesPage'

const NICKNAME_KEY = 'study-buddy-nickname'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [currentSubject, setCurrentSubject]   = useState(null)
  const [showVocabScanner, setShowVocabScanner] = useState(false)
  const [showTaskManager,  setShowTaskManager]  = useState(false)
  const [showNotes,        setShowNotes]         = useState(false)
  const [showTodoInput,    setShowTodoInput]     = useState(false)
  const [addTrigger,       setAddTrigger]        = useState(0)
  const nickname = localStorage.getItem(NICKNAME_KEY) || '익명'

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />
  }

  // 어느 탭이 활성인지
  const activeTab = showTaskManager ? 'task' : showVocabScanner ? 'vocab' : showNotes ? 'notes' : 'home'

  function navTask() {
    setShowVocabScanner(false); setShowNotes(false); setCurrentSubject(null); setShowTaskManager(true); setShowTodoInput(false)
  }
  function navVocab() {
    setShowTaskManager(false); setShowNotes(false); setCurrentSubject(null); setShowVocabScanner(true); setShowTodoInput(false)
  }
  function navNotes() {
    setShowTaskManager(false); setShowVocabScanner(false); setCurrentSubject(null); setShowNotes(true); setShowTodoInput(false)
  }
  function navHome() {
    setShowTaskManager(false); setShowVocabScanner(false); setShowNotes(false); setCurrentSubject(null); setShowTodoInput(false)
  }
  function handleNavAdd() {
    if (activeTab === 'home') { setShowTodoInput(true) }
    else { setAddTrigger(t => t + 1) }
  }

  let content
  if (showVocabScanner) {
    content = <VocabScanner onBack={() => setShowVocabScanner(false)} nickname={nickname} addTrigger={addTrigger} />
  } else if (showTaskManager) {
    content = <TaskManager onBack={() => setShowTaskManager(false)} nickname={nickname} addTrigger={addTrigger} />
  } else if (showNotes) {
    content = <NotesPage onBack={() => setShowNotes(false)} addTrigger={addTrigger} />
  } else if (currentSubject) {
    content = <SubjectDetail subject={currentSubject} onBack={() => setCurrentSubject(null)} />
  } else {
    content = (
      <SubjectList
        onSelectSubject={setCurrentSubject}
        onOpenVocabScanner={navVocab}
        onOpenTaskManager={navTask}
        showTodoInput={showTodoInput}
        onCloseTodoInput={() => setShowTodoInput(false)}
      />
    )
  }

  return (
    <>
      {content}

      {/* ── 하단 네비게이션 (항상 표시) ─────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-1"
        style={{
          height: 64,
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 -1px 0 rgba(0,0,0,0.04), 0 -8px 32px rgba(0,0,0,0.05)',
        }}
      >
        {/* TASK */}
        <button onClick={navTask} className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={activeTab === 'task' ? '#E8694A' : '#8B7E76'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <span className="text-[8px] font-black tracking-wider leading-none"
            style={{ color: activeTab === 'task' ? '#E8694A' : '#8B7E76', fontFamily: 'JetBrains Mono, monospace' }}>TASK</span>
        </button>

        {/* NOTES (오답노트) */}
        <button onClick={navNotes} className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={activeTab === 'notes' ? '#E8694A' : '#8B7E76'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          <span className="text-[8px] font-black tracking-wider leading-none"
            style={{ color: activeTab === 'notes' ? '#E8694A' : '#8B7E76', fontFamily: 'JetBrains Mono, monospace' }}>NOTES</span>
        </button>

        {/* HOME (중앙 FAB) */}
        <button className="flex flex-col items-center justify-center flex-1 h-full relative" onClick={navHome}>
          <div
            className="rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{
              width: 54, height: 54, marginTop: -22,
              background: activeTab === 'home'
                ? 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)'
                : 'linear-gradient(135deg, #c2b8b0 0%, #8B7E76 100%)',
              boxShadow: activeTab === 'home'
                ? '0 4px 20px rgba(232,105,74,0.50), 0 0 0 3px rgba(232,105,74,0.15)'
                : '0 4px 16px rgba(0,0,0,0.18)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        </button>

        {/* + ADD */}
        <button onClick={handleNavAdd} className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)', boxShadow: '0 2px 10px rgba(232,105,74,0.40)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span className="text-[8px] font-black tracking-wider leading-none"
            style={{ color: '#E8694A', fontFamily: 'JetBrains Mono, monospace' }}>ADD</span>
        </button>

        {/* VOCAB */}
        <button onClick={navVocab} className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={activeTab === 'vocab' ? '#E8694A' : '#8B7E76'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            <line x1="9" y1="8" x2="15" y2="8"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="12" y2="16"/>
          </svg>
          <span className="text-[8px] font-black tracking-wider leading-none"
            style={{ color: activeTab === 'vocab' ? '#E8694A' : '#8B7E76', fontFamily: 'JetBrains Mono, monospace' }}>VOCAB</span>
        </button>
      </div>
    </>
  )
}
