import { useState } from 'react'
import SplashScreen from './SplashScreen'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'
import VocabScanner from './VocabScanner'

const NICKNAME_KEY = 'study-buddy-nickname'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [currentSubject, setCurrentSubject] = useState(null)
  const [showVocabScanner, setShowVocabScanner] = useState(false)
  const nickname = localStorage.getItem(NICKNAME_KEY) || '익명'

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />
  }

  if (showVocabScanner) {
    return (
      <VocabScanner
        onBack={() => setShowVocabScanner(false)}
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
    />
  )
}
