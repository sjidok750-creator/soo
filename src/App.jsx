import { useState } from 'react'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'
import VocabScanner from './VocabScanner'
import TaskManager from './TaskManager'

const NICKNAME_KEY = 'study-buddy-nickname'

export default function App() {
  const [currentSubject, setCurrentSubject] = useState(null)
  const [showVocabScanner, setShowVocabScanner] = useState(false)
  const [showTaskManager, setShowTaskManager] = useState(false)
  const nickname = localStorage.getItem(NICKNAME_KEY) || '익명'

  if (showVocabScanner) {
    return (
      <VocabScanner
        onBack={() => setShowVocabScanner(false)}
        nickname={nickname}
      />
    )
  }

  if (showTaskManager) {
    return (
      <TaskManager
        onBack={() => setShowTaskManager(false)}
        nickname={nickname}
      />
    )
  }

  if (currentSubject) {
    return (
      <SubjectDetail
        subject={currentSubject}
        onBack={() => setCurrentSubject(null)}
      />
    )
  }

  return (
    <SubjectList
      onSelectSubject={setCurrentSubject}
      onOpenVocabScanner={() => setShowVocabScanner(true)}
      onOpenTaskManager={() => setShowTaskManager(true)}
    />
  )
}
