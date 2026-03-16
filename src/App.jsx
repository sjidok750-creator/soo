import { useState } from 'react'
import SplashScreen from './SplashScreen'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'
import VocabScanner from './VocabScanner'
import TaskManager from './TaskManager'

const NICKNAME_KEY = 'study-buddy-nickname'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [currentSubject, setCurrentSubject]   = useState(null)
  const [showVocabScanner, setShowVocabScanner] = useState(false)
  const [showTaskManager,  setShowTaskManager]  = useState(false)
  const [showTodoInput,    setShowTodoInput]     = useState(false)
  const nickname = localStorage.getItem(NICKNAME_KEY) || '익명'

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />
  }

  // 어느 탭이 활성인지
  const activeTab = showTaskManager ? 'task' : showVocabScanner ? 'vocab' : 'home'

  function navTask() {
    setShowVocabScanner(false); setCurrentSubject(null); setShowTaskManager(true); setShowTodoInput(false)
  }
  function navVocab() {
    setShowTaskManager(false); setCurrentSubject(null); setShowVocabScanner(true); setShowTodoInput(false)
  }
  function navFab() {
    if (activeTab !== 'home') {
      setShowTaskManager(false); setShowVocabScanner(false); setCurrentSubject(null)
      setShowTodoInput(true)
    } else {
      setShowTodoInput(v => !v)
    }
  }

  let content
  if (showVocabScanner) {
    content = <VocabScanner onBack={() => setShowVocabScanner(false)} nickname={nickname} />
  } else if (showTaskManager) {
    content = <TaskManager onBack={() => setShowTaskManager(false)} nickname={nickname} />
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

        {/* FIND */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#8B7E76" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="text-[8px] font-black tracking-wider leading-none"
            style={{ color: '#8B7E76', fontFamily: 'JetBrains Mono, monospace' }}>FIND</span>
        </button>

        {/* + FAB */}
        <button className="flex flex-col items-center justify-center flex-1 h-full relative" onClick={navFab}>
          <div
            className="rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{
              width: 54, height: 54, marginTop: -22,
              background: (activeTab === 'home' && showTodoInput)
                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #F5956A 0%, #E8694A 100%)',
              boxShadow: (activeTab === 'home' && showTodoInput)
                ? '0 4px 20px rgba(16,185,129,0.50), 0 0 0 3px rgba(16,185,129,0.15)'
                : '0 4px 20px rgba(232,105,74,0.50), 0 0 0 3px rgba(232,105,74,0.15)',
            }}
          >
            {(activeTab === 'home' && showTodoInput) ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
          </div>
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

        {/* STATS */}
        <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-60 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#8B7E76" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
            <line x1="3" y1="20" x2="21" y2="20"/>
          </svg>
          <span className="text-[8px] font-black tracking-wider leading-none"
            style={{ color: '#8B7E76', fontFamily: 'JetBrains Mono, monospace' }}>STATS</span>
        </button>
      </div>
    </>
  )
}
